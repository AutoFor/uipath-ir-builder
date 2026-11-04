// XAML を読んで IR にする（generate.ts の逆）。npm の依存なし。
//
//   node tools/ir/import-xaml.ts <file.xaml>... [--out <dir>] [--print] [--verbose]
//     --out     IR を <dir>/<workflow>.json に書き出す
//     --print   IR を標準出力に出す
//     --verbose 捨てたものを1件ずつ出す（既定は種類ごとの件数と、注釈などの中身があるものだけ）
//   終了コード: 0 = 取り込めて検証も通った / 1 = 取り込めない、または検証で弾かれた
//
// 方針:
// - 値を黙って捨てない。捨てるものは dropped に、意味が変わるかもしれないものは warnings に、IR に書けないものは errors に入れる
// - 捨ててよいもの（dropped）: ViewState、IdRef、HintSize、注釈、生成器が足し直す値（既定値、GUID）、{x:Null}（値なし）
// - 書けないもの（errors）: C# の式、Flowchart、StateMachine、IR に無い要素構文、表に無い型
// - 取り込んだあと checkRoundTrip で XAML を作り直して比べ、残った違いも warnings に出す
//
// {vb, cs} の cs は XAML に無いので戻らない。C# に直せない式は Coded の生成で CODED_EXPR になる（IR を手で直す）。

import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve as resolvePath } from "node:path";
import { fileURLToPath } from "node:url";
import type { Activity, Catalog, ObjType, Prop } from "./catalog.ts";
import { argumentListElement, defaultSlot, delegateArgs, funcInfo, isArgumentList, isExpressionChild, listElementType, literalMapValue, loadCatalog, objectImpls, objectTypes, objTypeFor, plainListElement, resolve } from "./catalog.ts";
import { generate } from "./generate.ts";
import type { ArgumentDecl, AssignOp, CatchDecl, InvokeArg, ListItem, Node, ObjValue, Value, VariableDecl, Workflow } from "./types.ts";
import { toXamlType, xamlTypeEntries } from "./types-xaml.ts";
import { objDefaults } from "./uia.ts";
import { isArgumentDict, isUntypedArgument, itemNames, validate } from "./validate.ts";

export type ImportIssue = { path: string; code: string; message: string };
export type Dropped = { path: string; kind: DroppedKind; name: string; value?: string };
export type DroppedKind = "IdRef" | "ViewState" | "注釈" | "既定値" | "GUID" | "値なし" | "空の delegate" | "その他";
export type ImportResult = { wf?: Workflow; errors: ImportIssue[]; warnings: ImportIssue[]; dropped: Dropped[] };

const X = "http://schemas.microsoft.com/winfx/2006/xaml";
const ACT = "http://schemas.microsoft.com/netfx/2009/xaml/activities";
const MC = "http://schemas.openxmlformats.org/markup-compatibility/2006";
const XMLNS = "http://www.w3.org/2000/xmlns/";
const XML = "http://www.w3.org/XML/1998/namespace";
const GUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const CARD = "UiPath.UIAutomationNext.Activities.NApplicationCard";
const ELEMENT_SCOPE = "UiPath.UIAutomationNext.Activities.NElementScope";

// 表示用の名前空間（ViewState など）
const isPresentationUri = (u: string) => /\/xaml\/activities\/(presentation|debugger)/.test(u);

// ---- XML ----

type Attr = { name: string; prefix: string; local: string; uri: string; value: string };
export type El = { name: string; prefix: string; local: string; uri: string; attrs: Attr[]; kids: El[]; text: string; ns: Map<string, string>; ignorable: Set<string>; selfClosed: boolean };

const ENT: Record<string, string> = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'" };
function decode(s: string): string {
  return s.replace(/&(#x[0-9a-fA-F]+|#\d+|\w+);/g, (all, e: string) => {
    if (e[0] === "#") return String.fromCodePoint(e[1] === "x" ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10));
    if (ENT[e] === undefined) throw new Error(`知らない実体参照 ${all}`);
    return ENT[e];
  });
}

export function parseXml(xml: string): El {
  let i = xml.charCodeAt(0) === 0xfeff ? 1 : 0;
  const stack: El[] = [];
  let root: El | undefined;
  const nameRe = /[^\s/>=]+/y;
  const fail = (m: string) => { throw new Error(`XML が読めない（${i} 文字目）: ${m}`); };
  const split = (n: string) => { const c = n.indexOf(":"); return c < 0 ? ["", n] : [n.slice(0, c), n.slice(c + 1)]; };
  while (i < xml.length) {
    if (xml[i] !== "<") {
      const j = xml.indexOf("<", i);
      const end = j < 0 ? xml.length : j;
      if (stack.length) stack[stack.length - 1].text += decode(xml.slice(i, end));
      else if (xml.slice(i, end).trim()) fail("ルートの外に文字がある");
      i = end;
      continue;
    }
    if (xml.startsWith("<!--", i)) { const j = xml.indexOf("-->", i); if (j < 0) fail("コメントが閉じていない"); i = j + 3; continue; }
    if (xml.startsWith("<?", i)) { const j = xml.indexOf("?>", i); if (j < 0) fail("処理命令が閉じていない"); i = j + 2; continue; }
    if (xml.startsWith("<![CDATA[", i)) {
      const j = xml.indexOf("]]>", i);
      if (j < 0 || !stack.length) fail("CDATA が正しくない");
      stack[stack.length - 1].text += xml.slice(i + 9, j);
      i = j + 3;
      continue;
    }
    if (xml.startsWith("</", i)) {
      const j = xml.indexOf(">", i);
      const name = xml.slice(i + 2, j).trim();
      const top = stack.pop();
      if (!top || top.name !== name) fail(`閉じタグ ${name} が合わない`);
      i = j + 1;
      continue;
    }
    i++;
    nameRe.lastIndex = i;
    const name = nameRe.exec(xml)?.[0];
    if (!name) { fail("タグ名が無い"); return root!; }
    i += name.length;
    const raw: [string, string][] = [];
    let selfClose = false;
    for (;;) {
      while (/\s/.test(xml[i] ?? "")) i++;
      if (xml[i] === ">") { i++; break; }
      if (xml.startsWith("/>", i)) { i += 2; selfClose = true; break; }
      nameRe.lastIndex = i;
      const an = nameRe.exec(xml)?.[0];
      if (!an) fail("属性名が無い");
      i += an!.length;
      while (/\s/.test(xml[i] ?? "")) i++;
      if (xml[i] !== "=") fail(`属性 ${an} に = が無い`);
      i++;
      while (/\s/.test(xml[i] ?? "")) i++;
      const q = xml[i];
      if (q !== '"' && q !== "'") fail(`属性 ${an} の引用符が無い`);
      const j = xml.indexOf(q, i + 1);
      if (j < 0) fail(`属性 ${an} が閉じていない`);
      raw.push([an!, decode(xml.slice(i + 1, j))]);
      i = j + 1;
    }
    const parent = stack[stack.length - 1];
    const ns = new Map(parent?.ns ?? [["xml", XML]]);
    for (const [k, v] of raw) {
      if (k === "xmlns") ns.set("", v);
      else if (k.startsWith("xmlns:")) ns.set(k.slice(6), v);
    }
    const ignorable = new Set(parent?.ignorable ?? []);
    const [prefix, local] = split(name);
    const el: El = { name, prefix, local, uri: ns.get(prefix) ?? "", attrs: [], kids: [], text: "", ns, ignorable, selfClosed: selfClose };
    for (const [k, v] of raw) {
      if (k === "xmlns" || k.startsWith("xmlns:")) { el.attrs.push({ name: k, prefix: "xmlns", local: k, uri: XMLNS, value: v }); continue; }
      const [ap, al] = split(k);
      const uri = ap ? ns.get(ap) ?? "" : "";
      if (uri === MC && al === "Ignorable") v.split(/\s+/).filter(Boolean).forEach((p) => { if (ns.get(p)) ignorable.add(ns.get(p)!); });
      el.attrs.push({ name: k, prefix: ap, local: al, uri, value: v });
    }
    if (parent) parent.kids.push(el);
    else if (root) fail("ルートが2つある");
    else root = el;
    if (!selfClose) stack.push(el);
  }
  if (stack.length) fail(`${stack[stack.length - 1].name} が閉じていない`);
  if (!root) fail("要素が無い");
  return root!;
}

const clrNs = (uri: string) => uri.match(/^clr-namespace:([^;]*)/)?.[1];

// ---- 型（x:TypeArguments → IR の型名）----

type TypeIndex = { exact: Map<string, string>; byUri: Map<string, string>; byNs: Map<string, string>; byLocal: Map<string, string> };
let typeIndex: TypeIndex | undefined;

function types(): TypeIndex {
  if (typeIndex) return typeIndex;
  const idx: TypeIndex = { exact: new Map(), byUri: new Map(), byNs: new Map(), byLocal: new Map() };
  // 同じ XAML の型に IR の名前が2つあるとき（Color と System.Drawing.Color）は完全名を選ぶ（C# で using が要らない）
  const put = (m: Map<string, string>, k: string, v: string) => { const o = m.get(k); if (o === undefined || (!o.includes(".") && v.startsWith("System."))) m.set(k, v); };
  for (const { ir, text, xmlns } of xamlTypeEntries()) {
    const fwd = toXamlType(ir);
    if (!("error" in fwd) && fwd.text !== text) continue; // 別の表に同じ名前があるとき（SecureString）は、実際に使われる方だけ
    const [p, l] = text.includes(":") ? text.split(":") : ["", text];
    const uri = p === "x" ? X : p === "" ? ACT : xmlns[p];
    if (!uri) continue;
    put(idx.exact, `${p}|${uri}|${l}`, ir);
    put(idx.byUri, `${uri}|${l}`, ir);
    put(idx.byLocal, l, ir);
    const c = clrNs(uri);
    if (c) put(idx.byNs, `${c}|${l}`, ir);
    if (p === "x") put(idx.byNs, `System|${l}`, ir); // s:String も x:String と同じ
  }
  return (typeIndex = idx);
}

export function irType(text: string, ns: Map<string, string>): { type: string } | { error: string } {
  let i = 0;
  const parse = (): string => {
    const m = /[^\s(),\[\]]+/y;
    m.lastIndex = i;
    const name = m.exec(text)?.[0];
    if (!name) throw new Error(`型の表記 "${text}" が読めない`);
    i += name.length;
    const [p, l] = name.includes(":") ? name.split(":") : ["", name];
    const uri = p === "x" ? (ns.get("x") ?? X) : ns.get(p) ?? (p === "" ? ACT : undefined);
    if (uri === undefined) throw new Error(`型 "${name}" の接頭辞が宣言されていない`);
    const idx = types();
    const c = clrNs(uri);
    let t = idx.exact.get(`${p}|${uri}|${l}`) ?? idx.byUri.get(`${uri}|${l}`) ?? (c ? idx.byNs.get(`${c}|${l}`) : idx.byLocal.get(l));
    if (!t) throw new Error(`型 "${name}"（${uri}）が types-xaml.ts の表に無い`);
    if (text[i] === "(") {
      i++;
      const args: string[] = [];
      for (;;) {
        while (text[i] === " ") i++;
        args.push(parse());
        while (text[i] === " ") i++;
        if (text[i] === ",") { i++; continue; }
        if (text[i] === ")") { i++; break; }
        throw new Error(`型の表記 "${text}" が読めない`);
      }
      t = `${t}<${args.join(", ")}>`;
    }
    while (text.startsWith("[]", i)) { i += 2; t += "[]"; }
    return t;
  };
  try {
    const type = parse();
    if (i !== text.trim().length) throw new Error(`型の表記 "${text}" が読めない`);
    return { type };
  } catch (e) { return { error: (e as Error).message }; }
}

// ---- 値 ----

const NUMERIC = /^(System\.)?(Nullable<System\.)?(U?Int(16|32|64)|Double|Decimal|Single|Byte)>?$/;
const BOOL = /^(System\.)?(Nullable<System\.)?Boolean>?$/;
const VB_STRING = /^"((?:[^"]|"")*)"$/;

const vbLit = (e: string): string | undefined => e.match(VB_STRING)?.[1].replace(/""/g, '"');
const canonNum = (s: string) => /^-?\d+(\.\d+)?$/.test(s) && String(Number(s)) === s;
const enumOk = (p: Prop, v: string) => !!p.enum && v.split(",").every((x) => p.enum!.includes(x.trim()));
const isBracket = (s: string) => s.startsWith("[") && s.endsWith("]");

type Ctx = {
  err: (path: string, code: string, message: string) => void;
  warn: (path: string, code: string, message: string) => void;
  drop: (path: string, kind: DroppedKind, name: string, value?: string) => void;
  cat: Catalog;
};

// 属性（または要素の中身）の文字列 → IR の値。undefined は「値なし」
function toValue(raw: string, p: Prop, at: string, c: Ctx): Value | undefined {
  if (raw === "{x:Null}") { c.drop(at, "値なし", p.name); return undefined; }
  // 表示名で読む TypeConverter の付いた enum は、生成器が {x:Static 接頭辞:型.値} で書く（knowledge/testing.md）
  const st = p.enumConverter ? raw.match(/^\{x:Static\s+[\w.]+:(\w+)\.(\w+)\}$/) : null;
  if (st && p.type.endsWith(`.${st[1]}`) && p.enum?.includes(st[2])) return st[2];
  const t =/^\{(?!\})/.test(raw) ? raw : undefined;
  if (t) {
    c.err(at, "UNSUPPORTED_MARKUP", `"${p.name}" のマークアップ拡張 ${t} は IR に書けない`);
    return undefined;
  }
  const lit = raw.startsWith("{}") ? raw.slice(2) : raw;
  if (p.kind === "out" || p.kind === "inout") {
    if (isBracket(raw)) return raw.slice(1, -1);
    c.err(at, "OUT_NOT_EXPR", `"${p.name}"（出力）の値 ${JSON.stringify(raw)} が [変数] の形でない`);
    return undefined;
  }
  if (p.kind === "prop") {
    if (BOOL.test(p.type) && /^(True|False)$/.test(lit)) return lit === "True";
    if (NUMERIC.test(p.type) && canonNum(lit)) return Number(lit);
    // CultureInfo（LocalizationCode="ja-JP"）は属性では文字列。裸の文字列にすると C# で ja-JP という式になる
    if (p.type === "System.String" || p.type === "System.Globalization.CultureInfo" || NUMERIC.test(p.type) || BOOL.test(p.type)) return { lit };
    return lit; // enum、Nullable<enum>、Color、Rectangle など。属性にそのまま書く
  }
  // in / child（式か、属性のリテラル）
  const isString = p.kind === "in" && p.type === "System.String";
  if (isBracket(raw)) {
    const e = raw.slice(1, -1);
    const l = vbLit(e);
    // String の入力は、生成器が { lit } を属性にそのまま書く。["abc"] の形を保つには式のままにする
    if (l !== undefined && (!isString || l.startsWith("["))) return { lit: l };
    return e;
  }
  if (enumOk(p, lit)) return lit;
  if (isString) return { lit };
  if (lit === "") { c.warn(at, "EMPTY_LITERAL", `"${p.name}"（${p.type}）の空の値を捨てた`); return undefined; }
  if (/^(True|False)$/.test(lit)) return lit === "True";
  if (/^-?\d+(\.\d+)?$/.test(lit)) return Number(lit);
  if (p.type === "System.TimeSpan" && /^(\d+\.)?\d+:\d+:\d+(\.\d+)?$/.test(lit)) return `TimeSpan.Parse("${lit}")`;
  if (/^(System\.Object|T\d?|System\.Activities\.InArgument)$/.test(p.type)) return { lit };
  c.err(at, "LITERAL_NOT_REPRESENTABLE", `"${p.name}"（${p.type}）のリテラル ${JSON.stringify(lit)} は IR に書けない`);
  return undefined;
}

// 既定 XAML の属性を IR の値にする（IR に無いときの意味。generate.ts は同じ値を XAML に足す）。GUID と、IR の値にできないものは入れない
export function xamlDefaultProps(cat: Catalog, a: Activity): Record<string, Value> {
  const out: Record<string, Value> = {};
  const c: Ctx = { cat, err: () => {}, warn: () => {}, drop: () => {} };
  for (const [k, raw] of Object.entries(cat.defaults.get(a.className) ?? {})) {
    const p = a.props.find((q) => q.name === k);
    if (!p || GUID.test(raw) || p.kind === "out" || p.kind === "inout") continue;
    const v = toValue(raw, p, k, c);
    if (v !== undefined) out[k] = v;
  }
  return out;
}

// 要素の中身（<InArgument>[x]</InArgument> など）を、属性と同じ文字列の形にする。無ければ undefined
function argText(el: El, at: string, c: Ctx): string | undefined {
  const kids = el.kids.filter((k) => !ignorableEl(k));
  if (kids.length === 0) { const t = el.text.trim(); return t === "" ? undefined : t === "{x:Null}" ? undefined : el.text; }
  if (kids.length > 1) { c.err(at, "UNSUPPORTED_ELEMENT", `<${el.name}> の中に要素が2つ以上ある`); return undefined; }
  const k = kids[0];
  if (k.local === "Null" && k.uri === X) return undefined;
  if (/^(VisualBasicValue|VisualBasicReference)$/.test(k.local)) {
    const e = k.attrs.find((a) => a.local === "ExpressionText")?.value;
    if (e === undefined) c.err(at, "UNSUPPORTED_ELEMENT", `${k.name} に ExpressionText が無い`);
    return e === undefined ? undefined : `[${e}]`;
  }
  if (/^CSharp(Value|Reference)$/.test(k.local)) { c.err(at, "CSHARP_EXPR", `C# の式は取り込めない: ${k.attrs.find((a) => a.local === "ExpressionText")?.value ?? k.text}`); return undefined; }
  if (k.local === "Literal" && k.uri === ACT) {
    const v = k.attrs.find((a) => a.local === "Value")?.value ?? k.text;
    return v;
  }
  c.err(at, "UNSUPPORTED_ELEMENT", `<${el.name}> の中の <${k.name}> は IR に書けない`);
  return undefined;
}

function ignorableEl(e: El): boolean { return e.ignorable.has(e.uri) || isPresentationUri(e.uri); }
function ignorableAttr(a: Attr, e: El): boolean { return !!a.uri && (e.ignorable.has(a.uri) || isPresentationUri(a.uri)); }

const dropKind = (name: string): DroppedKind =>
  /WorkflowViewState\.IdRef$/.test(name) ? "IdRef" : /Annotation/.test(name) ? "注釈" : /ViewState|HintSize/.test(name) ? "ViewState" : "その他";

// ---- 本体 ----

const BLOCKED: Record<string, string> = {
  Flowchart: "UNSUPPORTED_FLOWCHART", FlowStep: "UNSUPPORTED_FLOWCHART", FlowDecision: "UNSUPPORTED_FLOWCHART", FlowSwitch: "UNSUPPORTED_FLOWCHART",
  StateMachine: "UNSUPPORTED_STATEMACHINE", State: "UNSUPPORTED_STATEMACHINE", FinalState: "UNSUPPORTED_STATEMACHINE", Transition: "UNSUPPORTED_STATEMACHINE",
};

// 既定値と同じ属性は IR に残さない。IR に無い props は、XAML でも C# でも既定 XAML の値として扱う（generate.ts と generate-coded.ts の xamlDefaultProps）
export function importXaml(xml: string, cat: Catalog): ImportResult {
  const r: ImportResult = { errors: [], warnings: [], dropped: [] };
  const c: Ctx = {
    cat,
    err: (path, code, message) => r.errors.push({ path, code, message }),
    warn: (path, code, message) => r.warnings.push({ path, code, message }),
    drop: (path, kind, name, value) => r.dropped.push({ path, kind, name, ...(value !== undefined ? { value } : {}) }),
  };
  let root: El;
  try { root = parseXml(xml); } catch (e) { c.err("", "XML_PARSE", (e as Error).message); return r; }
  if (root.local !== "Activity") { c.err("", "NOT_WORKFLOW", `ルートが <Activity> でない（<${root.name}>）`); return r; }

  const wf: Workflow = { workflow: "", body: [] };
  const scope = new Map<string, string>();
  for (const a of root.attrs) {
    if (a.uri === XMLNS) continue;
    if (a.uri === X && a.local === "Class") { wf.workflow = a.value; continue; }
    if (a.uri === MC) continue;
    if (/ExpressionActivityEditor$/.test(a.local) && a.value === "C#") { c.err("Activity", "CSHARP_EXPR", "C# の式のワークフロー（ExpressionActivityEditor=C#）は取り込めない"); continue; }
    if (ignorableAttr(a, root) || a.local === "VisualBasic.Settings") { if (a.value !== "{x:Null}") c.drop("Activity", dropKind(a.name), a.name, a.value); continue; }
    if (a.local.startsWith(`${wf.workflow || "Main"}.`) || a.local.includes(".")) { c.warn("Activity", "ARGUMENT_DEFAULT", `引数の既定値など ${a.name}=${JSON.stringify(a.value)} は IR に書けないので捨てた`); continue; }
    c.warn("Activity", "UNKNOWN_ROOT_ATTR", `ルートの属性 ${a.name} を捨てた`);
  }
  if (!wf.workflow) c.err("Activity", "NO_CLASS", "x:Class が無い");

  const acts: El[] = [];
  for (const k of root.kids) {
    if (k.uri === X && k.local === "Members") {
      wf.arguments = k.kids.flatMap((m) => argument(m));
      if (!wf.arguments.length) delete wf.arguments;
      continue;
    }
    if (k.local.startsWith("TextExpression.")) continue; // 使う名前空間と参照。checkRoundTrip で過不足を見る
    if (ignorableEl(k) || k.local === "VisualBasic.Settings") { c.drop("Activity", dropKind(k.name), k.name); continue; }
    if (k.local.includes(".")) { c.warn("Activity", "ARGUMENT_DEFAULT", `<${k.name}>（引数の既定値など）は IR に書けないので捨てた`); continue; }
    acts.push(k);
  }
  for (const a of wf.arguments ?? []) scope.set(a.name, a.type);
  if (acts.length !== 1) c.err("Activity", "BAD_ROOT", `ルートの下のアクティビティは1つのはず（${acts.length} 個）`);
  else {
    const n = node(acts[0], acts[0].local, scope, undefined);
    if (n) {
      // 名前がワークフロー名の Sequence は、生成器がルートに足すもの。IR では workflow の variables と body に戻す。
      // 子が Sequence 1つだけのときは、戻すとそれがルートになってしまうので残す
      const hoist = n.act === "Sequence" && n.name === wf.workflow && !n.props && !(n.body?.length === 1 && n.body[0].act === "Sequence") && (n.body?.length ?? 0) > 0;
      if (hoist) {
        if (n.variables) wf.variables = n.variables;
        wf.body = n.body!;
      } else wf.body = [n];
    }
  }
  r.wf = wf;
  return r;

  function argument(m: El): ArgumentDecl[] {
    if (m.local !== "Property") { c.err("x:Members", "UNSUPPORTED_MEMBER", `<${m.name}> は読めない`); return []; }
    const name = attr(m, "Name"), type = attr(m, "Type") ?? "";
    const g = type.match(/^(In|Out|InOut)Argument\((.+)\)$/);
    if (!name || !g) { c.err(`x:Members.${name}`, "UNSUPPORTED_MEMBER", `引数でないメンバー（Type=${type}）は IR に書けない`); return []; }
    const t = typeOf(g[2], m, `x:Members.${name}`);
    for (const a of m.attrs) if (a.local !== "Name" && a.local !== "Type" && a.uri !== XMLNS) c.drop(`x:Members.${name}`, dropKind(a.name), a.name, a.value);
    return t ? [{ name, dir: g[1] as ArgumentDecl["dir"], type: t }] : [];
  }

  function typeOf(text: string, el: El, at: string): string | undefined {
    const t = irType(text, el.ns);
    if ("error" in t) { c.err(at, "UNKNOWN_TYPE", t.error); return undefined; }
    return t.type;
  }

  function findActivity(el: El, hasTypeArg: boolean, at: string): Activity | undefined {
    if (BLOCKED[el.local] && (el.uri === ACT || el.uri.includes("System.Activities"))) { c.err(at, BLOCKED[el.local], `${el.local} は IR に無いので取り込めない`); return undefined; }
    const clr = clrNs(el.uri);
    let cands = cat.activities.filter((a) => a.className === el.local && (clr ? a.clrType === `${clr}.${el.local}` : a.xmlns === el.uri));
    if (!cands.length) {
      c.err(at, "UNKNOWN_ACT", `<${el.name}>（${el.uri}）がカタログに無い`);
      return undefined;
    }
    const byArity = cands.filter((a) => (a.genericArity > 0) === hasTypeArg);
    if (byArity.length) cands = byArity;
    const usable = cands.filter((a) => !a.obsolete && a.browsable);
    if (usable.length) cands = usable;
    if (cands.length > 1) { c.err(at, "AMBIGUOUS_ACT", `<${el.name}> の候補が複数ある: ${cands.map((x) => x.clrType).join(", ")}`); return undefined; }
    return cands[0];
  }

  function actName(a: Activity, hasTypeArg: boolean): string {
    const s = resolve(cat, a.className, hasTypeArg);
    return "activity" in s && s.activity.clrType === a.clrType && s.activity.xmlns === a.xmlns ? a.className : a.clrType;
  }

  function node(el: El, at: string, scopeIn: Map<string, string>, scopeGuid: string | undefined): Node | undefined {
    const taAttr = el.attrs.find((x) => x.uri === X && x.local === "TypeArguments");
    const a = findActivity(el, !!taAttr, at);
    if (!a) return undefined;
    const n: Node = { act: actName(a, !!taAttr) };
    const scope = new Map(scopeIn);
    if (taAttr) { const t = typeOf(taAttr.value, el, at); if (t) n.typeArg = t; }

    // 子の前に変数を読む（型の決定と、代入先の型のため）
    const vs = el.kids.find((k) => k.local === `${el.local}.Variables`);
    if (vs) {
      const vkids = vs.kids.filter((k) => !ignorableEl(k));
      const vlist = vkids.length === 1 && vkids[0].local === "Collection" ? vkids[0].kids : vkids;
      n.variables = vlist.filter((k) => !ignorableEl(k)).flatMap((v) => variable(v, `${at}.Variables`));
      for (const v of n.variables) scope.set(v.name, v.type);
      if (!n.variables.length) delete n.variables;
    }

    const props: Record<string, Value> = {};
    let innerGuid = scopeGuid;
    const defs = cat.defaults.get(a.className) ?? {};
    const isScope = a.clrType === CARD || a.clrType === ELEMENT_SCOPE;
    for (const x of el.attrs) {
      if (x.uri === XMLNS || (x.uri === X && x.local === "TypeArguments")) continue;
      if (x.uri === X && x.local === "Key") continue;
      if (x.uri === X) { c.err(at, "UNSUPPORTED_MARKUP", `${x.name} は IR に書けない`); continue; }
      if (ignorableAttr(x, el)) {
        const kind = dropKind(x.name);
        c.drop(at, kind, x.name, x.value);
        if (kind === "注釈") c.warn(at, "ANNOTATION", `注釈を捨てた: ${x.value}`);
        continue;
      }
      if (x.local.includes(".")) { c.warn(at, "UNKNOWN_ATTACHED", `付加プロパティ ${x.name}=${JSON.stringify(x.value)} を捨てた`); continue; }
      if (x.local === "DisplayName") { n.name = x.value; continue; }
      const p = a.props.find((q) => q.name === x.local);
      if (!p) { c.err(at, "UNKNOWN_PROP", `${a.className} に "${x.local}" は無い（カタログ）`); continue; }
      // 生成器が足し直すもの
      if (isScope && x.local === "ScopeGuid" && GUID.test(x.value)) { innerGuid = x.value; c.drop(at, "GUID", x.local, x.value); continue; }
      if (scopeGuid && (x.local === "ScopeIdentifier" || x.local === "DestinationScopeIdentifier") && x.value === scopeGuid) { c.drop(at, "GUID", x.local, x.value); continue; }
      const d = defs[x.local];
      if (d !== undefined && (GUID.test(d) ? GUID.test(x.value) : d === x.value && !(p.required && !p.overloadGroups?.length))) {
        c.drop(at, GUID.test(d) ? "GUID" : "既定値", x.local, x.value);
        continue;
      }
      if (p.type === "System.Type") {
        const m = x.value.match(/^\{x:Type\s+(.+)\}$/);
        if (!m) { if (x.value === "{x:Null}") c.drop(at, "値なし", x.local); else c.err(at, "UNSUPPORTED_MARKUP", `"${x.local}" は {x:Type ...} のはず（${x.value}）`); continue; }
        const t = typeOf(m[1], el, at);
        if (t) props[x.local] = t;
        continue;
      }
      if (/\r/.test(x.value)) c.warn(at, "CRLF", `"${x.local}" の改行 CRLF は LF になる`);
      const v = toValue(x.value, p, `${at}.${x.local}`, c);
      if (v !== undefined) props[x.local] = v;
    }

    let untypedType: string | undefined;
    const content: El[] = [];
    const slot = (p: Prop, nodes: Node[]) => {
      const dslot = defaultSlot(a);
      if (p.name === "Then") n.then = [...(n.then ?? []), ...nodes];
      else if (p.name === "Else") n.else = [...(n.else ?? []), ...nodes];
      else if (dslot?.name === p.name && !n.slots) n.body = [...(n.body ?? []), ...nodes];
      else (n.slots ??= {})[p.name] = [...(n.slots?.[p.name] ?? []), ...nodes];
    };
    const kidsScope = () => new Map(scope);
    const setItem = (names: string[], kat: string) => {
      if (!names.length) return;
      const v = names.length === 1 ? names[0] : names;
      if (n.item !== undefined && JSON.stringify(n.item) !== JSON.stringify(v)) { c.warn(kat, "DELEGATE_NAMES", `同じアクティビティの delegate で引数名が違う（${JSON.stringify(n.item)} と ${JSON.stringify(v)}）。IR は1つしか持てない`); return; }
      n.item = v;
    };

    for (const k of el.kids) {
      if (ignorableEl(k)) { c.drop(at, dropKind(k.name), k.name); continue; }
      const dot = k.local.indexOf(".");
      if (dot < 0) { content.push(k); continue; }
      const owner = k.local.slice(0, dot), pname = k.local.slice(dot + 1);
      const kat = `${at}.${pname}`;
      if (owner !== el.local) {
        const objProp = a.props.some((q) => q.name === pname) && (k.uri === el.uri);
        if (!objProp) { c.warn(at, "UNKNOWN_ATTACHED", `付加プロパティの要素 <${k.name}> を捨てた`); continue; }
      }
      if (pname === "Variables") continue;
      const p = a.props.find((q) => q.name === pname);
      if (!p) { c.err(kat, "UNKNOWN_PROP", `${a.className} に "${pname}" は無い（カタログ）`); continue; }
      propElement(k, p, kat);
    }

    // コンテンツ（プロパティ要素で包まれていない子）。x:Key 付きは Switch の分岐、それ以外は子の一覧
    const keyed = content.filter((k) => k.attrs.some((x) => x.uri === X && x.local === "Key"));
    const plain = content.filter((k) => !keyed.includes(k));
    if (keyed.length) {
      if (!a.props.some((q) => q.name === "Cases")) c.err(at, "UNSUPPORTED_ELEMENT", `${a.className} の x:Key 付きの子は読めない`);
      else {
        n.cases = {};
        for (const k of keyed) caseOf(k, n.cases, at);
      }
    }
    if (plain.length) {
      const target = a.props.find((q) => q.name === "Activities" && q.kind === "children") ?? (a.props.filter((q) => q.kind === "children").length === 1 ? a.props.find((q) => q.kind === "children") : undefined);
      if (!target) c.err(at, "UNSUPPORTED_ELEMENT", `${a.className} に要素 <${plain[0].name}> は置けない（IR に無い形）`);
      else slot(target, plain.flatMap((k, i) => {
        const x = node(k, `${at}/${k.local}[${i}]`, kidsScope(), innerGuid);
        return x ? [x] : [];
      }));
    }
    // <Sequence ...></Sequence>（子が0個）。自己終了の <Sequence /> と書き分けられるよう、空の body を持つ
    if (!plain.length && !el.selfClosed && !el.kids.length && !n.body && a.props.some((q) => q.name === "Activities" && q.kind === "children")) n.body = [];
    if (el.text.trim()) c.err(at, "UNSUPPORTED_ELEMENT", `<${el.name}> の中の文字 ${JSON.stringify(el.text.trim())} は読めない`);

    // Assign のように型が書かれない引数（To / Value）。代入先の宣言と同じなら typeArg は要らない
    if (untypedType && !n.typeArg) {
      const out = a.props.find((q) => q.kind === "out" && isUntypedArgument(q.type));
      const v = out && props[out.name];
      const declared = typeof v === "string" ? scope.get(v) : undefined;
      if (!declared || !sameType(declared, untypedType)) n.typeArg = untypedType;
    }
    if (Object.keys(props).length) n.props = props;
    return n;

    function propElement(k: El, p: Prop, kat: string) {
      const kids = k.kids.filter((x) => !ignorableEl(x));
      for (const x of k.kids) if (ignorableEl(x)) c.drop(kat, dropKind(x.name), x.name);
      const only = kids.length === 1 && kids[0].local === "Null" && kids[0].uri === X;
      if (only || (!kids.length && !k.text.trim())) { c.drop(kat, "値なし", p.name); return; }
      if (kids.some((x) => /^CSharp(Value|Reference)$/.test(x.local))) { c.err(kat, "CSHARP_EXPR", `C# の式は取り込めない`); return; }

      if (a.className === "TryCatch" && p.name === "Catches") { n.catches = kids.flatMap((x, i) => catchOf(x, `${kat}[${i}]`)); return; }
      if (p.name === "AssignOperations") { n.assigns = assigns(kids, kat); return; }
      if (p.name === "Cases") { n.cases ??= {}; for (const x of kids) caseOf(x, n.cases, kat); return; }
      if (p.kind === "prop" && (isArgumentDict(p.type) || literalMapValue(p.type))) return dict(k, kids, p, kat);
      if (p.kind === "prop" && (isArgumentList(p.type) || plainListElement(p.type) || listElementType(p.type))) return list(kids, p, kat);
      switch (p.kind) {
        case "delegate": return delegate(kids, p, kat);
        case "children": slot(p, (kids.length === 1 && /^(List|Collection)$/.test(kids[0].local) ? kids[0].kids.filter((x) => !ignorableEl(x)) : kids).flatMap((x, i) => { const r = node(x, `${kat}/${x.local}[${i}]`, kidsScope(), innerGuid); return r ? [r] : []; })); return;
        case "child":
          // Activity<T> の子は、式（VisualBasicValue など）のことも、値を返すアクティビティ（AnchorBase.AnchorProvider の WaitUiElementAppear）のこともある
          if (isExpressionChild(p) && !(kids.length === 1 && !/^(VisualBasic(Value|Reference)|Literal|Null)$/.test(kids[0].local))) { const t = argText(k, kat, c); if (t !== undefined) { const v = toValue(t, p, kat, c); if (v !== undefined) props[p.name] = v; } return; }
          if (kids.length !== 1) { c.err(kat, "UNSUPPORTED_ELEMENT", `"${p.name}" に子が ${kids.length} 個ある`); return; }
          { const r = node(kids[0], `${kat}/${kids[0].local}`, kidsScope(), innerGuid); if (r) slot(p, unwrap(r, p.name)); }
          return;
        case "in": case "out": case "inout": {
          if (kids.length === 1 && /^(In|Out|InOut)Argument$/.test(kids[0].local)) {
            const ta = kids[0].attrs.find((x) => x.uri === X && x.local === "TypeArguments");
            if (isUntypedArgument(p.type) && ta) untypedType = typeOf(ta.value, kids[0], kat);
            const t = argText(kids[0], kat, c);
            if (t === undefined) { c.drop(kat, "値なし", p.name); return; }
            if (/\r/.test(t)) c.warn(kat, "CRLF", `"${p.name}" の改行 CRLF は LF になる`);
            const v = toValue(t, p, kat, c);
            if (v !== undefined) props[p.name] = v;
            return;
          }
          const t = argText(k, kat, c);
          if (t === undefined) { c.drop(kat, "値なし", p.name); return; }
          const v = toValue(t, p, kat, c);
          if (v !== undefined) props[p.name] = v;
          return;
        }
      }
      const t = objTypeForEl(p, kids[0]);
      if (t) {
        if (kids.length !== 1) { c.err(kat, "UNSUPPORTED_ELEMENT", `"${p.name}" に要素が ${kids.length} 個ある`); return; }
        const o = obj(t, kids[0], kat);
        if (objectImpls[p.type] && t.clrType !== objectImpls[p.type][0]) o["$type"] = t.className;
        (n.objs ??= {})[p.name] = o;
        return;
      }
      c.err(kat, "UNSUPPORTED_ELEMENT", `"${p.name}"（${p.type}）の要素 <${kids[0]?.name ?? "文字"}> は IR に書けない`);
    }

    function dict(k: El, kids: El[], p: Prop, kat: string) {
      const inner = kids.length === 1 && kids[0].local === "Dictionary" ? kids[0].kids.filter((x) => !ignorableEl(x)) : kids;
      const map = literalMapValue(p.type);
      const out: InvokeArg[] = [];
      for (const x of inner) {
        const key = x.attrs.find((q) => q.uri === X && q.local === "Key")?.value;
        const iat = `${kat}.${key}`;
        if (key === undefined) { c.err(kat, "BAD_DICT", `<${x.name}> に x:Key が無い`); continue; }
        if (map === "String") { out.push({ name: key, value: { lit: x.text } } as unknown as InvokeArg); continue; }
        const dm = x.local.match(/^(In|Out|InOut)Argument$/);
        if (!dm) { c.err(iat, "BAD_DICT", `辞書の要素 <${x.name}> は読めない`); continue; }
        const t = argText(x, iat, c);
        if (t === undefined) { c.warn(iat, "EMPTY_DICT_VALUE", `辞書のキー "${key}" は値が無いので IR に書けず、捨てた`); continue; }
        const v: Value = dm[1] === "In" ? inValue(t) : isBracket(t) ? t.slice(1, -1) : t;
        if (map === "InArgument") { out.push({ name: key, value: v } as unknown as InvokeArg); continue; }
        const ta = x.attrs.find((q) => q.uri === X && q.local === "TypeArguments");
        const type = ta ? typeOf(ta.value, x, iat) : undefined;
        if (!type) { if (!ta) c.err(iat, "BAD_DICT", `辞書の要素に x:TypeArguments が無い`); continue; }
        out.push({ name: key, dir: dm[1] as InvokeArg["dir"], type, value: v });
      }
      if (a.className === "InvokeWorkflowFile" && p.name === "Arguments") { if (out.length) n.args = out; }
      else (n.dicts ??= {})[p.name] = out;
    }

    function list(kids: El[], p: Prop, kat: string) {
      const wrapper = kids.length === 1 && kids[0].local === "List" ? kids[0] : undefined;
      if (!wrapper) { c.err(kat, "BAD_LIST", `"${p.name}" は <scg:List> で包まれているはず`); return; }
      const items = wrapper.kids.filter((x) => !ignorableEl(x));
      const out: ListItem[] = [];
      const el2 = listElementType(p.type);
      const ot = el2 ? objectTypes.get(el2) : undefined;
      items.forEach((x, i) => {
        const iat = `${kat}[${i}]`;
        if (isArgumentList(p.type)) {
          const t = argText(x, iat, c);
          if (t === undefined) { c.warn(iat, "EMPTY_LIST_VALUE", `値の無い要素を捨てた`); return; }
          if (!isBracket(t)) { out.push({ lit: t }); return; }
          out.push(inValue(t));
          return;
        }
        const plain = plainListElement(p.type);
        if (plain) { out.push(plain === "System.String" ? { lit: x.text } : x.text.trim()); return; }
        if (ot) {
          const item: Record<string, Value> = {};
          for (const q of x.attrs) {
            if (q.uri === XMLNS) continue;
            if (ignorableAttr(q, x)) { c.drop(iat, dropKind(q.name), q.name, q.value); continue; }
            const pp = ot.props.find((z) => z.name === q.local);
            if (!pp) { c.err(iat, "UNKNOWN_PROP", `${ot.className} に "${q.local}" は無い`); continue; }
            const v = toValue(q.value, pp, `${iat}.${q.local}`, c);
            if (v !== undefined) item[q.local] = v;
          }
          for (const pe of x.kids.filter((z) => !ignorableEl(z))) {
            const pn = pe.local.slice(pe.local.indexOf(".") + 1);
            if (!ot.props.some((z) => z.name === pn)) { c.err(iat, "UNKNOWN_PROP", `${ot.className} に "${pn}" は無い`); continue; }
            const arg = pe.kids.find((z) => !ignorableEl(z));
            if (!arg) continue;
            const v = typedArg(arg, `${iat}.${pn}`);
            if (v !== undefined) item[pn] = v;
          }
          out.push(item);
          return;
        }
        const v = typedArg(x, iat);
        if (v !== undefined) out.push(v);
      });
      (n.lists ??= {})[p.name] = out;
      if (isArgumentList(p.type) && !argumentListElement(p.type, n.typeArg)) c.err(kat, "TYPE_UNKNOWN", `"${p.name}" の要素の型が決まらない`);
    }

    // <InArgument x:TypeArguments="x:Int32">[5]</InArgument> → 5（生成器は値の形から要素の型を決める）
    function typedArg(x: El, iat: string): Value | undefined {
      const ta = x.attrs.find((q) => q.uri === X && q.local === "TypeArguments")?.value;
      const t = argText(x, iat, c);
      if (t === undefined) return undefined;
      if (!isBracket(t)) return { lit: t };
      const e = t.slice(1, -1);
      if (ta === "x:Int32" && /^-?\d+$/.test(e)) return Number(e);
      if (ta === "x:Double" && canonNum(e) && !Number.isInteger(Number(e))) return Number(e);
      if (ta === "x:Boolean" && /^(True|False)$/.test(e)) return e === "True";
      if (ta !== "x:String") c.warn(iat, "LIST_ITEM_TYPE", `要素の型 ${ta} は生成器が String にする（値: ${e}）`);
      return inValue(t);
    }

    function delegate(kids: El[], p: Prop, kat: string) {
      if (kids.length !== 1 || !/^Activity(Action|Func)$/.test(kids[0].local)) { c.err(kat, "UNSUPPORTED_ELEMENT", `"${p.name}" は ActivityAction / ActivityFunc のはず`); return; }
      const d = kids[0];
      const isFunc = d.local === "ActivityFunc";
      if (!(isFunc ? funcInfo(p) : delegateArgs(p, n.typeArg))) { c.err(kat, "UNSUPPORTED_ELEMENT", `"${p.name}"（${p.type}）は IR に書けない`); return; }
      const names: string[] = [];
      const inner = kidsScope();
      const bodies: El[] = [];
      for (const x of d.kids) {
        if (ignorableEl(x)) { c.drop(kat, dropKind(x.name), x.name); continue; }
        const m = x.local.match(/^Activity(?:Action|Func)\.(Argument\d*|Result)$/);
        if (!m) { if (x.local.includes(".")) c.err(kat, "UNSUPPORTED_ELEMENT", `<${x.name}> は IR に書けない`); else bodies.push(x); continue; }
        if (m[1] === "Result") { c.err(kat, "UNSUPPORTED_ELEMENT", `ActivityFunc.Result は IR に書けない（生成器は戻り値の子を直接書く）`); continue; }
        const arg = x.kids.find((z) => z.local === "DelegateInArgument");
        const name = arg && attr(arg, "Name");
        if (!arg || !name) { c.err(kat, "UNSUPPORTED_ELEMENT", `<${x.name}> に DelegateInArgument Name が無い`); continue; }
        names.push(name);
        const ta = arg.attrs.find((z) => z.uri === X && z.local === "TypeArguments");
        const t = ta && typeOf(ta.value, arg, kat);
        if (t) inner.set(name, t);
      }
      if (bodies.length > 1) { c.err(kat, "UNSUPPORTED_ELEMENT", `delegate の中の子が ${bodies.length} 個ある`); return; }
      if (!bodies.length) { c.drop(kat, "空の delegate", p.name); return; }
      const r = node(bodies[0], `${kat}/${bodies[0].local}`, inner, innerGuid);
      if (!isFunc) {
        const types = delegateArgs(p, n.typeArg)!;
        const dflt = itemNames({ act: "" }, types.length);
        if (JSON.stringify(names) !== JSON.stringify(dflt.filter((_, i) => types[i] !== "System.Activities.Activity"))) setItem(names, kat);
      }
      if (r) slot(p, unwrap(r, isFunc ? p.name : "Body"));
    }

    function catchOf(x: El, cat2: string): CatchDecl[] {
      const ta = x.attrs.find((q) => q.uri === X && q.local === "TypeArguments");
      const type = ta && typeOf(ta.value, x, cat2);
      if (!type) { if (!ta) c.err(cat2, "UNSUPPORTED_ELEMENT", "Catch に x:TypeArguments が無い"); return []; }
      const action = x.kids.find((z) => z.local === "ActivityAction") ?? x.kids.find((z) => z.local === "Catch.Action")?.kids.find((z) => z.local === "ActivityAction");
      const out: CatchDecl = { type, body: [] };
      if (!action) { c.warn(cat2, "EMPTY_CATCH", "本体の無い Catch は、空の Sequence になる"); return [out]; }
      const inner = kidsScope();
      for (const z of action.kids) {
        if (ignorableEl(z)) continue;
        if (z.local === "ActivityAction.Argument") {
          const name = z.kids[0] && attr(z.kids[0], "Name");
          if (name && name !== "exception") out.var = name;
          if (name) inner.set(name, type);
          continue;
        }
        const r = node(z, `${cat2}/${z.local}`, inner, innerGuid);
        if (r) out.body.push(...unwrap(r, "Body"));
      }
      if (!out.body.length) c.warn(cat2, "EMPTY_CATCH", "本体の無い Catch は、空の Sequence になる");
      return [out];
    }

    function assigns(kids: El[], kat: string): AssignOp[] {
      const inner = kids.length === 1 && kids[0].local === "List" ? kids[0].kids : kids;
      const out: AssignOp[] = [];
      inner.forEach((op, i) => {
        const iat = `${kat}[${i}]`;
        const toEl = op.kids.find((z) => z.local.endsWith(".To"))?.kids[0];
        const valEl = op.kids.find((z) => z.local.endsWith(".Value"))?.kids[0];
        const to = toEl && argText(toEl, iat, c);
        const val = valEl && argText(valEl, iat, c);
        if (to === undefined && val === undefined) { c.drop(iat, "値なし", "AssignOperation"); return; }
        if (to === undefined || val === undefined) { c.err(iat, "UNSUPPORTED_ELEMENT", "AssignOperation の To / Value の片方しか無い"); return; }
        for (const a2 of op.attrs) if (ignorableAttr(a2, op)) c.drop(iat, dropKind(a2.name), a2.name, a2.value);
        out.push({ to: isBracket(to) ? to.slice(1, -1) : to, value: inValue(val) });
      });
      return out;
    }

    function caseOf(k: El, into: Record<string, Node[]>, kat: string) {
      const key = k.attrs.find((x) => x.uri === X && x.local === "Key")?.value;
      if (key === undefined) { c.err(kat, "UNSUPPORTED_ELEMENT", `Switch の分岐 <${k.name}> に x:Key が無い`); return; }
      if (k.local === "Null" && k.uri === X) { c.warn(kat, "EMPTY_CASE", `分岐 "${key}" は中身が無いので、空の分岐になる`); into[key] = []; return; }
      const r = node(k, `${kat}/${k.local}[${key}]`, kidsScope(), innerGuid);
      if (r) into[key] = unwrap(r, key);
    }
  }

  // [式] / 文字列のリテラル。exprText の逆（{ lit } は "..." になる）
  function inValue(t: string): Value {
    if (!isBracket(t)) return { lit: t };
    const e = t.slice(1, -1);
    const l = vbLit(e);
    return l !== undefined ? { lit: l } : e;
  }

  function variable(v: El, at: string): VariableDecl[] {
    const name = attr(v, "Name");
    const ta = v.attrs.find((x) => x.uri === X && x.local === "TypeArguments");
    if (v.local !== "Variable" || !name || !ta) { c.err(at, "UNSUPPORTED_ELEMENT", `変数 <${v.name}> が読めない`); return []; }
    const type = typeOf(ta.value, v, `${at}.${name}`);
    if (!type) return [];
    const out: VariableDecl = { name, type };
    let def = attr(v, "Default");
    for (const a of v.attrs) {
      if (a.uri === XMLNS || a.uri === X || a.local === "Name" || a.local === "Default") continue;
      if (ignorableAttr(a, v)) { c.drop(`${at}.${name}`, dropKind(a.name), a.name, a.value); continue; }
      c.warn(`${at}.${name}`, "VARIABLE_ATTR", `変数の属性 ${a.name}=${JSON.stringify(a.value)} は IR に書けないので捨てた`);
    }
    const defEl = v.kids.find((k) => k.local === "Variable.Default");
    if (defEl) {
      const inner = defEl.kids.find((k) => !ignorableEl(k));
      const text = inner ? argText(defEl, `${at}.${name}`, c) : defEl.text;
      if (text !== undefined) def = text;
    }
    if (def !== undefined && def !== "{x:Null}") {
      if (isBracket(def)) out.default = def.slice(1, -1);
      else if (type === "String") out.default = `"${(def.startsWith("{}") ? def.slice(2) : def).replace(/"/g, '""')}"`;
      else if (/^(True|False|-?\d+(\.\d+)?)$/.test(def)) out.default = def;
      else if (type === "TimeSpan" && /^(\d+\.)?\d+:\d+:\d+(\.\d+)?$/.test(def)) out.default = `TimeSpan.Parse("${def}")`;
      else c.err(`${at}.${name}`, "LITERAL_NOT_REPRESENTABLE", `変数の既定値 ${JSON.stringify(def)} は IR に書けない`);
    }
    return [out];
  }

  function objTypeForEl(p: Prop, el: El | undefined): ObjType | undefined {
    if (!el) return undefined;
    const impls = objectImpls[p.type];
    if (impls) return impls.map((x) => objectTypes.get(x)).find((t) => t?.className === el.local);
    const t = objTypeFor(p.type);
    return t && t.className === el.local ? t : undefined;
  }

  function obj(t: ObjType, el: El, at: string): ObjValue {
    const out: ObjValue = {};
    const defs = objDefaults[t.clrType] ?? {};
    for (const a of el.attrs) {
      if (a.uri === XMLNS) continue;
      if (ignorableAttr(a, el)) { c.drop(at, dropKind(a.name), a.name, a.value); continue; }
      if (a.uri === X && a.local === "TypeArguments") { const ta = typeOf(a.value, el, at); if (ta) out["$typeArg"] = ta; continue; } // Filter<T> など
      const p = t.props.find((q) => q.name === a.local);
      if (!p) { c.err(at, "UNKNOWN_PROP", `${t.className} に "${a.local}" は無い（カタログ）`); continue; }
      const d = defs[a.local];
      if (d !== undefined && (d === a.value || (d === "guid" && GUID.test(a.value)))) { c.drop(at, d === "guid" ? "GUID" : "既定値", a.local, a.value); continue; }
      const v = toValue(a.value, p, `${at}.${a.local}`, c);
      if (v !== undefined) out[a.local] = v;
    }
    for (const k of el.kids) {
      if (ignorableEl(k)) { c.drop(at, dropKind(k.name), k.name); continue; }
      const pn = k.local.slice(k.local.indexOf(".") + 1);
      const kat = `${at}.${pn}`;
      const p = t.props.find((q) => q.name === pn);
      if (!p || !k.local.includes(".")) { c.err(at, "UNKNOWN_PROP", `${t.className} の要素 <${k.name}> は読めない`); continue; }
      const kids = k.kids.filter((x) => !ignorableEl(x));
      if (!kids.length || (kids[0].local === "Null" && kids[0].uri === X)) { c.drop(kat, "値なし", pn); continue; }
      const sub = objTypeForEl(p, kids[0]);
      if (sub) {
        out[pn] = obj(sub, kids[0], kat);
        if (objectImpls[p.type]) (out[pn] as ObjValue)["$type"] = sub.className; // 抽象クラス（Operator）は生成器と同じ形（実装を必ず書く）
        continue;
      }
      const m = p.type.match(/^System\.Collections\.Generic\.(?:IEnumerable|List|IList|ICollection)<(.+)>$/);
      if (kids[0].local === "List" && m) {
        const itemType = objectTypes.get(m[1] === "UiPath.UIAutomationNext.Contracts.ITarget" ? "UiPath.UIAutomationNext.Target" : m[1]);
        const items = kids[0].kids.filter((x) => !ignorableEl(x));
        if (isArgumentList(p.type)) { out[pn] = items.flatMap((x) => { const s = argText(x, kat, c); return s === undefined ? [] : [inValue(s)]; }) as unknown as ObjValue[]; continue; }
        if (plainListElement(p.type) === "System.String") { out[pn] = items.map((x) => ({ lit: x.text })) as unknown as ObjValue[]; continue; }
        if (itemType) { out[pn] = items.map((x, i) => obj(itemType, x, `${kat}[${i}]`)); continue; }
      }
      if (kids.length === 1 && /^(In|Out|InOut)Argument$/.test(kids[0].local)) {
        const s = argText(kids[0], kat, c);
        const v = s === undefined ? undefined : toValue(s, p, kat, c);
        if (v !== undefined) out[pn] = v;
        continue;
      }
      c.err(kat, "UNSUPPORTED_ELEMENT", `${t.className}.${pn}（${p.type}）の要素 <${kids[0].name}> は IR に書けない`);
    }
    return out;
  }
}

// 子が1つの置き場所に2つ以上書くと、生成器は「置き場所の名前」の Sequence で包む（single）。IR ではその包みを外す
function unwrap(n: Node, slotName: string): Node[] {
  const plain = n.act === "Sequence" && n.name === slotName && !n.variables && !n.props && (n.body?.length ?? 0) >= 2;
  return plain ? n.body! : [n];
}

function attr(el: El, name: string): string | undefined { return el.attrs.find((a) => a.local === name && !a.prefix)?.value; }

const sameType = (a: string, b: string) => {
  const x = toXamlType(a), y = toXamlType(b);
  return !("error" in x) && !("error" in y) && x.text === y.text;
};

// ---- 往復の確認 ----

// GUID を出てきた順の番号にする。同じ GUID を指しているか（ScopeGuid と ScopeIdentifier）も比べられる
export function normalizeXaml(s: string): string {
  const seen = new Map<string, number>();
  return s.replace(/^﻿/, "").replace(/\r\n/g, "\n").replace(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi, (g) => {
    const k = g.toLowerCase();
    if (!seen.has(k)) seen.set(k, seen.size + 1);
    return `<guid${seen.get(k)}>`;
  });
}

// 意味の比較用に、XAML を「場所 属性=値」の行の並びにする。接頭辞、属性の順、ViewState、{x:Null}、要素と属性の書き分けの違いは無視する
export function canonLines(xml: string): string[] {
  const out: string[] = [];
  const root = parseXml(xml);
  const norm = (v: string) => {
    let s = v.replace(/\r\n/g, "\n").replace(GUID, "<guid>");
    if (s.startsWith("{}")) s = s.slice(2);
    const m = s.match(/^\["((?:[^"]|"")*)"\]$/);
    if (m) s = m[1].replace(/""/g, '"');
    const lit = s.match(/^\[(True|False|-?\d+(?:\.\d+)?)\]$/);
    if (lit) s = lit[1];
    if (/^-?\d+\.\d+$/.test(s)) s = String(Number(s));
    return s;
  };
  const typeText = (t: string, el: El) => { const r = irType(t, el.ns); return "type" in r ? r.type : t; };
  const walk = (el: El, path: string) => {
    const lines: string[] = [];
    for (const a of el.attrs) {
      if (a.uri === XMLNS || ignorableAttr(a, el) || a.value === "{x:Null}" || a.local === "Capacity") continue;
      if (a.uri === X && a.local === "TypeArguments") { if (el.local !== "Assign") lines.push(`${path} @type=${typeText(a.value, el)}`); continue; }
      lines.push(`${path} @${a.local}=${norm(a.value)}`);
    }
    if (el.text.trim() && !el.kids.length) lines.push(`${path} #text=${norm(el.text)}`);
    const props: El[] = [];
    let idx = 0;
    const seq: El[] = [];
    const flatten = (e: El) => {
      for (const k of e.kids) {
        if (ignorableEl(k)) continue;
        // Dictionary / List の入れ物は無視する（包む・包まないの違い）
        if (/^(Dictionary|List)$/.test(k.local)) { flatten(k); continue; }
        if (k.local.includes(".")) props.push(k); else seq.push(k);
      }
    };
    flatten(el);
    for (const k of seq) walk(k, `${path}/${k.local}[${idx++}]`);
    props.sort((x, y) => x.local.localeCompare(y.local));
    for (const k of props) {
      const pn = k.local.slice(k.local.indexOf(".") + 1);
      const kids = k.kids.filter((x) => !ignorableEl(x));
      if (!kids.length && !k.text.trim()) continue;
      if (kids.length === 1 && kids[0].local === "Null" && kids[0].uri === X) continue;
      const argEl = kids.length === 1 && /^(In|Out|InOut)Argument$/.test(kids[0].local) && !kids[0].attrs.some((a) => a.local === "Key") ? kids[0] : undefined;
      if (argEl) {
        if (!argEl.text.trim() && !argEl.kids.length) continue;
        const vb = argEl.kids.find((x) => /^VisualBasic(Value|Reference)$/.test(x.local));
        const lit = argEl.kids.find((x) => x.local === "Literal");
        const t = vb ? `[${vb.attrs.find((a) => a.local === "ExpressionText")?.value}]` : lit ? lit.attrs.find((a) => a.local === "Value")?.value ?? lit.text : argEl.text;
        lines.push(`${path} @${pn}=${norm(t)}`);
        continue;
      }
      // Activities / Branches はコンテンツなので、包む・包まないを同じに扱う
      if (/^(Activities|Branches|Cases)$/.test(pn)) { kids.forEach((x) => walk(x, `${path}/${x.local}[${idx++}]`)); continue; }
      walk(k, `${path}.${pn}`);
    }
    out.push(...lines);
  };
  for (const k of root.kids) {
    if (k.uri === X && k.local === "Members") { for (const m of k.kids) out.push(`arg ${attr(m, "Name")} ${(() => { const g = (attr(m, "Type") ?? "").match(/^(In|Out|InOut)Argument\((.+)\)$/); return g ? `${g[1]} ${typeText(g[2], m)}` : attr(m, "Type"); })()}`); continue; }
    if (k.local.startsWith("TextExpression.") || ignorableEl(k) || k.local.includes(".")) continue;
    walk(k, k.local);
  }
  return out;
}

function diffLines(a: string[], b: string[]): { lost: string[]; added: string[] } {
  const count = new Map<string, number>();
  for (const x of a) count.set(x, (count.get(x) ?? 0) + 1);
  const added: string[] = [];
  for (const x of b) { const n = count.get(x) ?? 0; if (n) count.set(x, n - 1); else added.push(x); }
  const lost: string[] = [];
  for (const [x, n] of count) for (let i = 0; i < n; i++) lost.push(x);
  return { lost, added };
}

const importsOf = (xml: string) => {
  const root = parseXml(xml);
  const pick = (name: string) => root.kids.filter((k) => k.local === `TextExpression.${name}`).flatMap((k) => k.kids.flatMap((l) => l.kids.map((x) => x.text.trim())));
  return { ns: pick("NamespacesForImplementation"), refs: pick("ReferencesForImplementation") };
};

// 取り込んだ IR から XAML を作り直して比べる。IR に残らなかったものが warnings になる
export function checkRoundTrip(xml: string, wf: Workflow, cat: Catalog): { xaml?: string; identical: boolean; sameMeaning: boolean; warnings: ImportIssue[] } {
  const warnings: ImportIssue[] = [];
  let again: string;
  try { again = generate(wf, cat); } catch (e) { return { identical: false, sameMeaning: false, warnings: [{ path: "", code: "ROUNDTRIP_GENERATE", message: `XAML を作り直せない: ${(e as Error).message}` }] }; }
  if (normalizeXaml(xml) === normalizeXaml(again)) return { xaml: again, identical: true, sameMeaning: true, warnings };
  const { lost, added } = diffLines(canonLines(xml), canonLines(again));
  for (const x of lost) warnings.push({ path: x.split(" ")[0], code: "ROUNDTRIP_LOST", message: `作り直すと消える: ${x}` });
  for (const x of added) warnings.push({ path: x.split(" ")[0], code: "ROUNDTRIP_ADDED", message: `作り直すと増える: ${x}` });
  const s = importsOf(xml), g = importsOf(again);
  const missNs = s.ns.filter((x) => !g.ns.includes(x)), missRefs = s.refs.filter((x) => !g.refs.includes(x));
  if (missNs.length) warnings.push({ path: "Activity", code: "EXTRA_IMPORT", message: `IR に持てない import（式で使っていると build で落ちる）: ${missNs.join(", ")}` });
  if (missRefs.length) warnings.push({ path: "Activity", code: "EXTRA_REFERENCE", message: `IR に持てない参照: ${missRefs.join(", ")}` });
  return { xaml: again, identical: false, sameMeaning: !lost.length && !added.length, warnings };
}

// ---- まとめ（CLI と migrate-report が使う）----

export type FullImport = ImportResult & { validation: ImportIssue[]; roundTrip?: { identical: boolean; sameMeaning: boolean } };

export function importAndCheck(xml: string, cat: Catalog): FullImport {
  const r = importXaml(xml, cat);
  const out: FullImport = { ...r, validation: [] };
  if (!r.wf || r.errors.length) return out;
  out.validation = validate(r.wf, cat);
  const rt = checkRoundTrip(xml, r.wf, cat);
  out.warnings = [...r.warnings, ...rt.warnings];
  out.roundTrip = { identical: rt.identical, sameMeaning: rt.sameMeaning };
  return out;
}

export function droppedSummary(d: Dropped[]): { kind: string; count: number; examples: string[] }[] {
  const m = new Map<string, Dropped[]>();
  for (const x of d) m.set(x.kind, [...(m.get(x.kind) ?? []), x]);
  return [...m].map(([kind, xs]) => ({ kind, count: xs.length, examples: [...new Set(xs.map((x) => x.name))].slice(0, 5) }));
}

export const CATALOG_FILES = [
  "catalog/System.Activities/6.0.0.json",
  "catalog/UiPath.System.Activities/26.10.0.json",
  "catalog/UiPath.UIAutomation.Activities/26.10.6.json",
  "catalog/UiPath.Excel.Activities/3.6.1.json",
  "catalog/UiPath.Persistence.Activities/1.13.0.json",
  "catalog/UiPath.Testing.Activities/25.10.1.json",
];

export const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "..", "..");

function main() {
  const args = process.argv.slice(2);
  const outIdx = args.indexOf("--out");
  const outDir = outIdx >= 0 ? args[outIdx + 1] : undefined;
  const print = args.includes("--print");
  const verbose = args.includes("--verbose");
  const files = args.filter((a, i) => !a.startsWith("--") && (outIdx < 0 || i !== outIdx + 1));
  if (!files.length) { console.error("使い方: node tools/ir/import-xaml.ts <file.xaml>... [--out <dir>] [--print] [--verbose]"); process.exit(2); }
  const cat = loadCatalog(repoRoot, CATALOG_FILES);
  let failed = false;
  const line = (i: ImportIssue) => `  ${i.code.padEnd(26)} ${i.path}: ${i.message}`;
  for (const f of files) {
    if (!existsSync(f)) { console.log(`NG ${f}: ファイルが無い`); failed = true; continue; }
    const r = importAndCheck(readFileSync(f, "utf8"), cat);
    const ok = !r.errors.length && !r.validation.length;
    if (!ok) failed = true;
    console.log(`${ok ? "OK" : "NG"} ${f}${r.roundTrip ? (r.roundTrip.identical ? "（往復で文字まで一致）" : r.roundTrip.sameMeaning ? "（往復で意味は同じ）" : "（往復で違いあり）") : ""}`);
    for (const i of r.errors) console.log(`  エラー ${line(i)}`);
    for (const i of r.validation) console.log(`  検証 ${line(i)}`);
    for (const i of r.warnings) console.log(`  警告 ${line(i)}`);
    for (const s of droppedSummary(r.dropped)) console.log(`  捨てた ${s.kind}: ${s.count} 件（${s.examples.join(", ")}）`);
    if (verbose) for (const d of r.dropped) console.log(`    ${d.kind} ${d.path} ${d.name}${d.value !== undefined ? `=${d.value}` : ""}`);
    if (print && r.wf) console.log(JSON.stringify(r.wf, null, 2));
    if (outDir && r.wf && ok) {
      mkdirSync(outDir, { recursive: true });
      const path = join(outDir, `${r.wf.workflow}.json`);
      writeFileSync(path, JSON.stringify(r.wf, null, 2) + "\n", "utf8");
      console.log(`  -> ${path}`);
    }
  }
  process.exit(failed ? 1 : 0);
}

if (process.argv[1] && resolvePath(process.argv[1]) === fileURLToPath(import.meta.url)) main();
