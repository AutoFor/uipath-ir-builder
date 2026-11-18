// 検証済みの IR から Coded Workflow（C#）を作る。XAML の generate.ts と同じ IR を入力にする。
//
// - 制御フロー（Sequence / If / ForEach / While / DoWhile / Switch / TryCatch / Assign / MultipleAssign / Break / Continue /
//   Throw / Rethrow / RetryScope）は C# の構文にする（下の builtin）
// - それ以外のアクティビティは mappings/<pkg>/<ClassName>.json の対応表でメソッド呼び出しにする。対応表が無ければエラー
// - VB の式は vb2cs.ts で C# に直す。直せない式はエラー（IR に { vb, cs } で書く）
//
// ワークフローの引数（uip rpa build の生成コードで確かめた形）:
//   In  → Execute の引数
//   Out → 戻り値。1つなら T を返し、引数名は "Output" になる。2つ以上なら名前付きタプル (T out_A, U out_B)
//   InOut → 未対応（Execute の ref / out 引数は Studio の生成コードがコンパイルできない）

import type { Catalog } from "./catalog.ts";
import { resolve, defaultSlot, delegateArgs } from "./catalog.ts";
import type { Workflow, Node, Value, Issue, CsExpr } from "./types.ts";
import type { Mapping, Variant, ObjArg } from "./mapping.ts";
import { refs, requiredRefs, scopeRefs, usingScope, versionLess, UIA_APP_TYPE } from "./mapping.ts";
import { excelVbForCs, excelFilterToCs, excelFilterValuesToCs } from "./excel.ts";
import { vbToCs, vbDefaultToCs, csType, csKeywords } from "./vb2cs.ts";
import { itemNames, validate } from "./validate.ts";
import { genericActivity, viaXamlArgs, viaXamlWorkflow, type GenericActivity } from "./coded-via-xaml.ts";
import { objToCs } from "./uia.ts";
import { xamlDefaultProps } from "./import-xaml.ts";
import { isTestCase } from "./testcase.ts";
import type { DescriptorMap } from "./coded-descriptors.ts";
import { readFileSync } from "node:fs";

// Coded のオプションのクラスの、new したときの値（coded-option-defaults.json）。これと同じ値の代入は書かない
const OPTION_DEFAULTS: Record<string, Record<string, string>> = JSON.parse(readFileSync(new URL("./coded-option-defaults.json", import.meta.url), "utf8"));
// C# の値を比べられる形にする（UiPath.….NClickType.Single → Single、true → True、30.0 → 30）
const normCs = (x: string) => { const t = x.trim().replace(/^\((?:double|int)\)\s*/, ""); if (/^(true|false)$/i.test(t)) return t[0].toUpperCase() + t.slice(1).toLowerCase(); if (/^-?\d+(\.\d+)?[dDfFmM]?$/.test(t)) return String(Number(t.replace(/[dDfFmM]$/, ""))); const e = t.match(/^[\w.]+\.(\w+)$/); return e && /^[A-Z]/.test(e[1]) && (t.includes("Enums.") || /^UiPath\.CodedWorkflows\.LogLevel\./.test(t)) ? e[1] : t; };
const isOptionDefault = (cls: string, prop: string, cs: string) => { const d = OPTION_DEFAULTS[cls.split(".").pop()!]?.[prop]; return d !== undefined && normCs(cs) === d; };

export type CodedOptions = {
  namespace: string;
  // InvokeWorkflowFile の WorkflowFileName（文字列リテラル）を書き換える。Coded 同士で呼ぶときに "Greet.xaml" → "coded/Greet.cs" にする
  invokePath?: (path: string) => string;
  // 対応表の無いアクティビティ（と、Coded API の無いパッケージの、対応表が API を呼ぶもの）を、部分木だけの XAML にして RunWorkflow で呼ぶ
  // （knowledge/coded-via-xaml.md）。dir はその XAML を置くフォルダ（プロジェクトからの相対パス。例 "coded/_xaml"）、
  // noApi は選んだ版のカタログに services（Coded API）の無いパッケージ。対応表が「Coded API なし」としているものも XAML 経由。
  // apiCheck は対応表で書いた C# を選んだ版の API で確かめ、合わなければ理由を返す（gen-coded.ts は tools/coded/check.ts の UNKNOWN_METHOD / NO_OVERLOAD）。
  // viaXaml が無ければ、これまでどおり NO_MAPPING / NO_CODED_API のエラー
  viaXaml?: { dir: string; noApi?: Iterable<string>; apiCheck?: (code: string) => string | undefined };
  // オブジェクトリポジトリ（coded-descriptors.ts の readDescriptors）。あれば、Reference がリポジトリにあるターゲット（objs.Target / objs.TargetApp）を
  // new TargetAnchorableModel { ... } ではなく Descriptors.<アプリ>.<画面>.<要素> で渡す（中身はリポジトリのもの）。先頭の引数に名前なしで置く
  descriptors?: DescriptorMap;
  // 表示名のキー（カタログの displayName）→ Studio の日本語の名前（catalog/<パッケージ>/<版>.ja.json）。
  // あれば、オプションを1行に1つずつ書き、行末に // <日本語の名前> を付ける
  labels?: Record<string, string>;
  // 1つの操作の直前に、手順名を Trace のログに出す（// 手順名 の代わり）
  traceLog?: boolean;
};

const NL = String.fromCharCode(10);

// 読みやすい形で前置きを省く名前空間（using があるときだけ）。中の型の名前が、ほかの using の名前空間とぶつからないもの
// 読みやすい形で、手順名のコメントを書かないアクティビティ（中身を見れば分かるもの）
const NO_COMMENT_ACTIVITIES = new Set(["LogMessage"]);

// traceLog で Trace のログを入れないアクティビティ（操作ではないもの：まとまり・分岐・繰り返し・例外・ログ・代入・コメントなど）
const NOT_TRACED_ACTIVITIES = new Set([
  "Sequence", "Flowchart", "FlowDecision", "FlowSwitch", "StateMachine", "State", "If", "IfElseIf", "Switch", "While", "DoWhile", "ForEach", "ForEachRow", "ParallelForEach", "Parallel",
  "TryCatch", "RetryScope", "Throw", "Rethrow", "Break", "Continue", "Return", "TerminateWorkflow",
  "LogMessage", "Comment", "CommentOut", "Assign", "MultipleAssign", "AddToCollection", "InvokeCode",
]);

// 読みやすい形でも、引数を1行に1つずつにしない呼び出し（短く読めるもの）
const ONE_LINE_CALLS = new Set(["Log"]);

const SHORTEN_NAMESPACES =["UiPath.UIAutomationNext.Enums", "UiPath.CodedWorkflows"];

// 1行の C#（ひな形）を「頭(引数, 引数, …)尾」に分ける。行の最後の呼び出し（閉じかっこの後ろが ; や空白だけ）だけを見る。
// 引数の区切りは、かっこ・波かっこ・角かっこ・文字列の外のカンマ。分けられなければ undefined
export function splitCall(line: string): { head: string; args: string[]; tail: string } | undefined {
  const tailM = line.match(/\)\s*;?\s*$/);
  if (!tailM) return undefined;
  const close = line.length - tailM[0].length;
  // close に対応する開きかっこを後ろから探す
  let depth = 0, open = -1, str: string | undefined;
  for (let i = close; i >= 0; i--) {
    const c = line[i];
    if (str) { if (c === str && line[i - 1] !== "\\") str = undefined; continue; }
    if (c === '"' || c === "'") { str = c; continue; }
    if (c === ")" || c === "}" || c === "]") depth++;
    else if (c === "(" || c === "{" || c === "[") { depth--; if (depth === 0) { open = i; break; } }
  }
  if (open <= 0 || line[open] !== "(") return undefined;
  const inner = line.slice(open + 1, close);
  const args: string[] = [];
  let cur = "", dep = 0; str = undefined;
  for (let i = 0; i < inner.length; i++) {
    const c = inner[i];
    if (str) { cur += c; if (c === str && inner[i - 1] !== "\\") str = undefined; continue; }
    if (c === '"' || c === "'") { str = c; cur += c; continue; }
    if ("({[".includes(c)) dep++;
    if (")}]".includes(c)) dep--;
    if (c === "," && dep === 0) { args.push(cur.trim()); cur = ""; continue; }
    cur += c;
  }
  if (str || dep !== 0) return undefined;
  if (cur.trim()) args.push(cur.trim());
  return { head: line.slice(0, open), args, tail: line.slice(close + 1) };
}

// 引数の値が Descriptors のとき、名前なしで先頭に置くための印
const DESC = "@@DESC@@";

// XAML 経由で呼ぶワークフロー（path はプロジェクトからの相対パス。XAML は呼ぶ側が generate.ts で作る）
// kind は "activity"（1つのアクティビティだけの汎用の XAML。_activities/）か "subtree"（その場の部分木。_xaml/）
export type ViaXamlFile = { path: string; wf: Workflow; at: string; kind: "activity" | "subtree" };

const baseUsings = ["System", "System.Collections.Generic", "System.Data", "System.IO", "System.Linq", "UiPath.CodedWorkflows", "UiPath.Platform.ResourceHandling"];

const builtin = new Set([
  "System.Activities.Statements.Sequence", "System.Activities.Statements.If", "System.Activities.Statements.ForEach",
  "UiPath.Core.Activities.ForEach", "UiPath.Core.Activities.ForEachRow", "System.Activities.Statements.While", "System.Activities.Statements.DoWhile",
  "System.Activities.Statements.Switch", "System.Activities.Statements.TryCatch", "System.Activities.Statements.Assign",
  "System.Activities.Statements.Parallel", "System.Activities.Statements.ParallelForEach", "UiPath.Core.Activities.RepeatNumberOfTimesX",
  "UiPath.Core.Activities.MultipleAssign", "UiPath.Core.Activities.Break", "UiPath.Core.Activities.Continue",
  "System.Activities.Statements.Throw", "System.Activities.Statements.Rethrow", "UiPath.Core.Activities.RetryScope",
  "UiPath.Core.Activities.Return", "UiPath.Core.Activities.Comment", "UiPath.Core.Activities.CommentOut", "UiPath.Core.Activities.Placeholder",
  "UiPath.Core.Activities.CheckTrue", "UiPath.Core.Activities.CheckFalse", "UiPath.Core.Activities.ChangeType",
  "UiPath.Core.Activities.InterruptibleWhile", "UiPath.Core.Activities.InterruptibleDoWhile",
]);
export const isBuiltin = (clrType: string) => builtin.has(clrType);

export function generateCoded(wf: Workflow, cat: Catalog, maps: Map<string, Mapping>, opt: CodedOptions): { code: string; issues: Issue[]; warnings: Issue[]; xamls: ViaXamlFile[] } {
  const issues: Issue[] = [];
  const warnings: Issue[] = [];
  const xamls: ViaXamlFile[] = [];
  const noApi = new Set(opt.viaXaml?.noApi ?? []);
  const usings = new Set(baseUsings);
  const lines: string[] = [];
  let tmp = 0;
  // Descriptors で開いた画面（内側ほど後ろ）と、いま組み立て中の呼び出しで渡した画面
  const screens: string[] = [];
  let openedScreen: string | undefined;
  let subtrees = 0; // 部分木の XAML（_xaml/<ワークフロー名>_<連番>）の数
  // ラムダ（"scope": "lambda"）の本体に直接ある Break / Continue。C# では return にする
  const lambdaExits = new Set<Node>();
  const add = (path: string, code: string, message: string) => issues.push({ path, code, message });
  // 改行を含む文（オプションを1行に1つずつ書いたもの）は、2行目からも同じ深さに字下げする
  const emit = (depth: number, s: string) => { for (const l of s.split(NL)) lines.push("    ".repeat(depth) + l); };

  const ins = (wf.arguments ?? []).filter((a) => a.dir === "In");
  const outs = (wf.arguments ?? []).filter((a) => a.dir === "Out");
  (wf.arguments ?? []).filter((a) => a.dir === "InOut").forEach((a) =>
    add(`arguments.${a.name}`, "CODED_INOUT", `InOut 引数 "${a.name}" は Coded では書けない（In と Out に分ける）`));
  const ret = outs.length === 0 ? "void" : outs.length === 1 ? csType(outs[0].type) : `(${outs.map((a) => `${csType(a.type)} ${a.name}`).join(", ")})`;

  // C# の予約語（out など）の名前は、変数にも引数にも使えない（C# の build が「; が必要です」で落ちる）
  function keyword(name: string, at: string) {
    if (csKeywords.has(name)) add(at, "CS_NAME", `名前 ${name} は C# の予約語なので、Coded では使えない。名前を変える`);
  }
  (wf.arguments ?? []).forEach((a, i) => keyword(a.name, `arguments[${i}]`));
  const scope = new Map((wf.arguments ?? []).map((a) => [a.name, a.type] as [string, string]));
  const d = 3;
  for (const a of outs) emit(d, `${csType(a.type)} ${a.name} = default;`);
  for (const [i, v] of (wf.variables ?? []).entries()) declare(v.name, v.type, v.default, d, `variables[${i}]`, scope);
  wf.body.forEach((n, i) => node(n, d, `body[${i}]`, scope));
  if (outs.length === 1) emit(d, `return ${outs[0].name};`);
  else if (outs.length > 1) emit(d, `return (${outs.map((a) => a.name).join(", ")});`);
  let body = lines.splice(0);
  // 読みやすい形（labels があるとき）では、using がある名前空間の前置きを省く（UiPath.UIAutomationNext.Enums.NAppCloseMode.Never → NAppCloseMode.Never）。
  // 名前がぶつからないと分かっている名前空間だけ。文字列の中は変えない
  if (opt.labels) {
    const short = SHORTEN_NAMESPACES.filter((ns) => usings.has(ns));
    if (short.length) {
      const re = new RegExp(`\\b(?:${short.map((s) => s.replace(/\./g, "\\.")).join("|")})\\.(?=[A-Z]\\w*\\.)`, "g");
      body = body.map((l) => l.split(/("(?:[^"\\]|\\.)*")/).map((seg, i) => (i % 2 ? seg : seg.replace(re, ""))).join(""));
    }
  }

  const out = [
    ...[...usings].map((u) => `using ${u};`),
    "",
    `namespace ${opt.namespace}`,
    "{",
    `    // tools/ir/gen-coded.ts で IR（${wf.workflow}）から生成。手で直さず IR を直す`,
    `    public class ${wf.workflow} : CodedWorkflow`,
    "    {",
    isTestCase(wf) ? "        [TestCase]" : "        [Workflow]",
    `        public ${ret} Execute(${ins.map((a) => `${csType(a.type)} ${a.name}`).join(", ")})`,
    "        {",
    ...body,
    "        }",
    "    }",
    "}",
    "",
  ];
  return { code: out.join("\r\n"), issues, warnings, xamls };

  // ---- 式 ----
  function expr(v: Value, at: string, sc: Map<string, string>): string {
    if (typeof v === "number") return String(v);
    if (typeof v === "boolean") return v ? "true" : "false";
    if (typeof v === "object") {
      if ("lit" in v) return csLit(v.lit);
      return v.cs;
    }
    const r = vbToCs(excelVbForCs(v, sc), sc);
    if ("error" in r) { add(at, "CODED_EXPR", `式 ${JSON.stringify(v)} を C# に直せない: ${r.error}`); return "/* ? */ default"; }
    return r.cs;
  }
  function lvalue(v: Value, at: string, sc: Map<string, string>): string {
    if (typeof v === "object" && "cs" in v) return v.cs; // C# の XAML から取り込んだ代入先（dt.Rows[0]["A"] など）
    if (typeof v !== "string") { add(at, "CODED_EXPR", "代入先は変数名で書く"); return "_"; }
    return expr(v, at, sc);
  }
  // 文字列にする。文字列だと分かるもの（リテラル、String の変数、文字列の連結）はそのまま
  function str(v: Value, at: string, sc: Map<string, string>): string {
    const e = expr(v, at, sc);
    if (typeof v === "object" && "lit" in v) return e;
    if (typeof v === "string") {
      const t = sc.get(v.trim()) ?? [...sc].find(([k]) => k.toLowerCase() === v.trim().toLowerCase())?.[1];
      if (t && /^(System\.)?String$/i.test(t)) return e;
      if (/^\s*"/.test(v) || /^\s*[\w.]+\s*&/.test(v) || /&/.test(v)) return e;
      if (/\.ToString\s*$/.test(v)) return e;
    }
    return `Convert.ToString(${e})`;
  }

  function declare(name: string, type: string, def: string | CsExpr | undefined, depth: number, at: string, sc: Map<string, string>) {
    keyword(name, at);
    let init = "default";
    if (typeof def === "object") init = def.cs; // C# の XAML から取り込んだ既定値
    else if (def !== undefined) {
      const r = vbDefaultToCs(def, type, sc);
      if ("error" in r) add(at, "CODED_EXPR", `既定値 ${JSON.stringify(def)} を C# に直せない: ${r.error}`);
      else init = r.cs;
    }
    emit(depth, `${csType(type)} ${name} = ${init};`);
    sc.set(name, type);
  }

  // ---- 文 ----
  function block(nodes: Node[] | undefined, depth: number, at: string, sc: Map<string, string>) {
    (nodes ?? []).forEach((c, i) => node(c, depth, `${at}[${i}]`, new Map(sc)));
  }

  function node(n: Node, depth: number, at: string, sc: Map<string, string>) {
    const r = resolve(cat, n.act, n.typeArg !== undefined);
    if ("error" in r) { add(at, "UNKNOWN_ACT", r.error); return; }
    const a = r.activity;
    const p = n.props ?? {};
    // 読みやすい形（labels があるとき）では、手順と手順のあいだに空行を入れる。
    // ブロックの先頭（直前が { か空行）と、まとまり（Sequence など）の見出しのすぐ下（直前がコメント）には入れない
    if (opt.labels && lines.length && !/^\s*(\{|\/\/.*|)$/.test(lines[lines.length - 1])) lines.push("");
    // 読みやすい形では、ログ（LogMessage）の手順名は書かない（Log(message: "…") のメッセージが説明になる）
    const noComment = !!opt.labels && NO_COMMENT_ACTIVITIES.has(a.className);
    // traceLog：1つの操作（クリック・入力・待機・状態の確認など）の直前に、手順名を Trace のログに出す（落ちたとき、最後に何をしようとしたかが残る）。
    // そのときは同じ内容の // 手順名 は書かない。まとまり（Sequence）・分岐・繰り返し・ログ・代入などには入れない
    const traced = !!opt.traceLog && !NOT_TRACED_ACTIVITIES.has(a.className);
    // 名前の無い手順は、アクティビティの種類名（Delay など）を出す
    if (traced) emit(depth, `Log(message: ${csLit((n.name ?? a.className).replace(/\r?\n/g, " "))}, level: UiPath.CodedWorkflows.LogLevel.Trace);`);
    else if (n.name && !noComment) emit(depth, `// ${n.name.replace(/\r?\n/g, " ")}`);
    if (!builtin.has(a.clrType)) return mapped(n, a.className, a.package, depth, at, sc);

    switch (a.className) {
      case "Sequence": {
        const own = n.variables?.length;
        if (own) emit(depth, "{");
        const inner = new Map(sc);
        (n.variables ?? []).forEach((v, i) => declare(v.name, v.type, v.default, depth + (own ? 1 : 0), `${at}.variables[${i}]`, inner));
        (n.body ?? []).forEach((c, i) => node(c, depth + (own ? 1 : 0), `${at}.body[${i}]`, new Map(inner)));
        if (own) emit(depth, "}");
        return;
      }
      case "If":
        emit(depth, `if (${expr(p.Condition, `${at}.props.Condition`, sc)})`);
        braces(depth, () => block(n.then, depth + 1, `${at}.then`, sc));
        if (n.else?.length) { emit(depth, "else"); braces(depth, () => block(n.else, depth + 1, `${at}.else`, sc)); }
        return;
      case "ForEach": {
        const [item] = itemNames(n, 1);
        const t = n.typeArg ? csType(n.typeArg) : "var";
        const inner = new Map(sc).set(item, n.typeArg ?? "Object");
        const idx = p.CurrentIndex !== undefined ? lvalue(p.CurrentIndex, `${at}.props.CurrentIndex`, sc) : undefined;
        if (p.Condition !== undefined) add(`${at}.props.Condition`, "CODED_UNSUPPORTED", "ForEach.Condition はまだ Coded に直せない（XAML の意味が未確認）");
        // MaxIterations: 本体を実行する回数の上限
        const cnt = p.MaxIterations !== undefined ? `__foreach${++tmp}` : undefined;
        if (cnt) emit(depth, `var ${cnt} = 0;`);
        if (idx) emit(depth, `${idx} = -1;`);
        emit(depth, `foreach (${t} ${item} in ${expr(p.Values, `${at}.props.Values`, sc)})`);
        braces(depth, () => {
          if (cnt) { emit(depth + 1, `if (${cnt} >= ${expr(p.MaxIterations, `${at}.props.MaxIterations`, sc)}) break;`); emit(depth + 1, `${cnt}++;`); }
          if (idx) emit(depth + 1, `${idx}++;`);
          block(n.body, depth + 1, `${at}.body`, inner);
        });
        return;
      }
      case "Parallel": {
        // 枝は宣言順に1つずつ実行する（XAML の Parallel も、待ちのない枝は宣言順に1つずつ動く）。
        // CompletionCondition は、枝が終わるたびに評価し、真なら残りの枝を実行しない
        const own = n.variables?.length;
        const d0 = depth + (own ? 1 : 0);
        if (own) emit(depth, "{");
        const inner = new Map(sc);
        (n.variables ?? []).forEach((v, i) => declare(v.name, v.type, v.default, d0, `${at}.variables[${i}]`, inner));
        const cond = p.CompletionCondition !== undefined ? expr(p.CompletionCondition, `${at}.props.CompletionCondition`, inner) : undefined;
        const branches = n.body ?? [];
        let dd = d0;
        branches.forEach((c, i) => {
          emit(dd, "{");
          node(c, dd + 1, `${at}.body[${i}]`, new Map(inner));
          emit(dd, "}");
          if (cond && i < branches.length - 1) { emit(dd, `if (!(${cond}))`); emit(dd, "{"); dd++; }
        });
        if (cond) for (let i = 0; i < Math.max(0, branches.length - 1); i++) { dd--; emit(dd, "}"); }
        if (own) emit(depth, "}");
        return;
      }
      case "ParallelForEach": {
        const [item] = itemNames(n, 1);
        const t = n.typeArg ? csType(n.typeArg) : "var";
        const inner = new Map(sc).set(item, n.typeArg ?? "Object");
        const cond = p.CompletionCondition !== undefined ? expr(p.CompletionCondition, `${at}.props.CompletionCondition`, sc) : undefined;
        emit(depth, `foreach (${t} ${item} in ${expr(p.Values, `${at}.props.Values`, sc)})`);
        braces(depth, () => { block(n.body, depth + 1, `${at}.body`, inner); if (cond) emit(depth + 1, `if (${cond}) break;`); });
        return;
      }
      case "RepeatNumberOfTimesX": {
        const [item] = itemNames(n, 1);
        const i = `__repeat${++tmp}`;
        const start = p.StartAt !== undefined ? expr(p.StartAt, `${at}.props.StartAt`, sc) : "1";
        emit(depth, `for (var ${i} = 0; ${i} < ${expr(p.NumberOfTimes, `${at}.props.NumberOfTimes`, sc)}; ${i}++)`);
        braces(depth, () => { emit(depth + 1, `int ${item} = ${start} + ${i};`); block(n.body, depth + 1, `${at}.body`, new Map(sc).set(item, "Int32")); });
        return;
      }
      case "ForEachRow": {
        // DataTable の行を foreach で回す。CurrentIndex は 0 始まりの行番号。MaxIterations は先頭から数えて打ち切る。
        // Condition / Values / ColumnNames など、行の選び方を変えるものはまだ Coded に直せない
        const [item] = itemNames(n, 1);
        const inner = new Map(sc).set(item, "DataRow");
        const idx = p.CurrentIndex !== undefined ? lvalue(p.CurrentIndex, `${at}.props.CurrentIndex`, sc) : undefined;
        for (const k of Object.keys(p)) if (!["DataTable", "CurrentIndex", "MaxIterations"].includes(k)) add(`${at}.props.${k}`, "CODED_UNSUPPORTED", `ForEachRow.${k} はまだ Coded に直せない`);
        const i = `__row${++tmp}`;
        if (idx) emit(depth, `${idx} = -1;`);
        emit(depth, `var ${i} = 0;`);
        emit(depth, `foreach (DataRow ${item} in ${expr(p.DataTable, `${at}.props.DataTable`, sc)}.Rows)`);
        braces(depth, () => {
          if (p.MaxIterations !== undefined) { emit(depth + 1, `if (${i} >= ${expr(p.MaxIterations, `${at}.props.MaxIterations`, sc)}) break;`); }
          emit(depth + 1, `${i}++;`);
          if (idx) emit(depth + 1, `${idx}++;`);
          block(n.body, depth + 1, `${at}.body`, inner);
        });
        return;
      }
      case "While":
        emit(depth, `while (${expr(p.Condition, `${at}.props.Condition`, sc)})`);
        braces(depth, () => block(n.body, depth + 1, `${at}.body`, sc));
        return;
      case "DoWhile":
        emit(depth, "do");
        braces(depth, () => block(n.body, depth + 1, `${at}.body`, sc), `while (${expr(p.Condition, `${at}.props.Condition`, sc)});`);
        return;
      case "Switch": {
        // C# の switch にすると、中の break がループではなく switch を抜けてしまう。if / else if にする
        const v = `__switch${++tmp}`;
        emit(depth, `var ${v} = ${expr(p.Expression, `${at}.props.Expression`, sc)};`);
        const t = (n.typeArg ?? "String").replace(/^System\./, "");
        let first = true;
        for (const [key, nodes] of Object.entries(n.cases ?? {})) {
          const k = t === "String" ? csLit(key) : /^(Int\d+|Double|Decimal|Int|Integer|Long)$/.test(t) ? key : `${csType(n.typeArg!)}.${key}`;
          emit(depth, `${first ? "" : "else "}if (Equals(${v}, ${k}))`);
          braces(depth, () => block(nodes, depth + 1, `${at}.cases.${key}`, sc));
          first = false;
        }
        const def = n.slots?.Default;
        if (def?.length) {
          if (!first) emit(depth, "else");
          braces(depth, () => block(def, depth + 1, `${at}.slots.Default`, sc));
        }
        return;
      }
      case "TryCatch":
        emit(depth, "try");
        braces(depth, () => block(n.body, depth + 1, `${at}.body`, sc));
        (n.catches ?? []).forEach((c, i) => {
          const name = c.var ?? "exception";
          emit(depth, `catch (${csType(c.type)} ${name})`);
          braces(depth, () => block(c.body, depth + 1, `${at}.catches[${i}].body`, new Map(sc).set(name, c.type)));
        });
        if (n.slots?.Finally?.length) { emit(depth, "finally"); braces(depth, () => block(n.slots!.Finally, depth + 1, `${at}.slots.Finally`, sc)); }
        return;
      case "Assign":
        emit(depth, `${lvalue(p.To, `${at}.props.To`, sc)} = ${expr(p.Value, `${at}.props.Value`, sc)};`);
        return;
      case "MultipleAssign":
        (n.assigns ?? []).forEach((x, i) => emit(depth, `${lvalue(x.to, `${at}.assigns[${i}].to`, sc)} = ${expr(x.value, `${at}.assigns[${i}].value`, sc)};`));
        return;
      case "Return": emit(depth, outs.length === 0 ? "return;" : outs.length === 1 ? `return ${outs[0].name};` : `return (${outs.map((x) => x.name).join(", ")});`); return;
      case "Comment": emit(depth, `// ${String(typeof p.Text === "object" && "lit" in p.Text ? p.Text.lit : p.Text ?? "").replace(/\r?\n/g, " ")}`); return;
      case "Placeholder": emit(depth, "// Placeholder"); return;
      case "CommentOut": emit(depth, "// CommentOut（中のアクティビティは実行されない）"); return; // Body は生成しない
      case "CheckTrue":
      case "CheckFalse": {
        // Expression を評価し、期待と違えば ErrorMessage の例外。Result には Expression の値
        const c = `__check${++tmp}`;
        emit(depth, `var ${c} = ${expr(p.Expression, `${at}.props.Expression`, sc)};`);
        emit(depth, `if (${a.className === "CheckTrue" ? "!" : ""}${c}) throw new Exception(${p.ErrorMessage !== undefined ? str(p.ErrorMessage, `${at}.props.ErrorMessage`, sc) : '""'});`);
        if (p.Result !== undefined) emit(depth, `${lvalue(p.Result, `${at}.props.Result`, sc)} = ${c};`);
        return;
      }
      case "ChangeType": {
        const t = csType(n.typeArg ?? "Object");
        emit(depth, `${lvalue(p.ConvertedValue, `${at}.props.ConvertedValue`, sc)} = (${t})Convert.ChangeType(${expr(p.SourceValue, `${at}.props.SourceValue`, sc)}, typeof(${t}));`);
        return;
      }
      case "InterruptibleWhile":
      case "InterruptibleDoWhile": {
        // CurrentIndex は 0 始まりの反復番号。MaxIterations 回まわったら抜ける。割り込み（ジョブの停止）は Coded では扱えない
        const idx = p.CurrentIndex !== undefined ? lvalue(p.CurrentIndex, `${at}.props.CurrentIndex`, sc) : `__loop${++tmp}`;
        const cond = expr(p.Condition, `${at}.props.Condition`, sc) + (p.MaxIterations !== undefined ? ` && ${idx} + 1 < ${expr(p.MaxIterations, `${at}.props.MaxIterations`, sc)}` : "");
        emit(depth, p.CurrentIndex !== undefined ? `${idx} = -1;` : `var ${idx} = -1;`);
        const inner = () => { emit(depth + 1, `${idx}++;`); block(n.body, depth + 1, `${at}.body`, sc); };
        if (a.className === "InterruptibleWhile") { emit(depth, `while (${cond})`); braces(depth, inner); }
        else { emit(depth, "do"); braces(depth, inner, `while (${cond});`); }
        return;
      }
      case "Break": emit(depth, lambdaExits.has(n) ? "return false;" : "break;"); return;
      case "Continue": emit(depth, lambdaExits.has(n) ? "return true;" : "continue;"); return;
      case "Throw": emit(depth, `throw ${expr(p.Exception, `${at}.props.Exception`, sc)};`); return;
      case "Rethrow": emit(depth, "throw;"); return;
      case "RetryScope": {
        // 例外が出たら RetryInterval 待って、合計 NumberOfRetries 回まで繰り返す。Condition（ActivityFunc）は未対応
        if (n.slots?.Condition) add(`${at}.slots.Condition`, "CODED_UNSUPPORTED", "RetryScope.Condition はまだ Coded に直せない");
        for (const k of Object.keys(p)) if (!["NumberOfRetries", "RetryInterval"].includes(k)) add(`${at}.props.${k}`, "CODED_UNSUPPORTED", `RetryScope.${k} はまだ Coded に直せない`);
        const i = `__retry${++tmp}`;
        const count = p.NumberOfRetries !== undefined ? expr(p.NumberOfRetries, `${at}.props.NumberOfRetries`, sc) : "3";
        const wait = p.RetryInterval !== undefined ? expr(p.RetryInterval, `${at}.props.RetryInterval`, sc) : "TimeSpan.FromSeconds(5)";
        emit(depth, `for (var ${i} = 1; ; ${i}++)`);
        braces(depth, () => {
          emit(depth + 1, "try");
          braces(depth + 1, () => { block(n.body, depth + 2, `${at}.body`, sc); emit(depth + 2, "break;"); });
          emit(depth + 1, `catch (Exception) when (${i} < ${count})`);
          braces(depth + 1, () => emit(depth + 2, `Delay(${wait});`));
        });
        return;
      }
    }
  }

  function braces(depth: number, inner: () => void, closeSuffix?: string) {
    emit(depth, "{");
    inner();
    emit(depth, closeSuffix ? `} ${closeSuffix}` : "}");
  }

  // ---- 対応表 ----
  // 対応表で書いた C# が、選んだ版の API に無いメソッド・オーバーロードを呼ぶなら（apiCheck が理由を返す）、書いた分を捨てて XAML 経由にする
  function mapped(n: Node, className: string, pkg: string, depth: number, at: string, sc: Map<string, string>) {
    const check = opt.viaXaml?.apiCheck;
    const l0 = lines.length, i0 = issues.length, w0 = warnings.length, x0 = xamls.length, s0 = subtrees;
    mappedCode(n, className, pkg, depth, at, sc);
    // 子を XAML 経由にしたいが、親のスコープ（Excel、Use Application など）の外に出すと検証を通らない、
    // またはスコープの変数（ブックのハンドルなど）が XAML の引数にできない。親ごと XAML 経由にする
    const added = issues.slice(i0);
    if (opt.viaXaml && added.length && added.every((i) => /^CODED_VIA_XAML_(INVALID|TYPE)$/.test(i.code) && i.path.startsWith(`${at}.`))) {
      lines.length = l0; issues.length = i0; warnings.length = w0; xamls.length = x0; subtrees = s0;
      return viaXaml(n, className, pkg, "中に Coded API の無いアクティビティがあり、それだけをスコープの外に出せない", depth, at, sc);
    }
    if (!check || issues.length > i0) return;
    const why = check(lines.slice(l0).join("\n"));
    if (!why) return;
    lines.length = l0; warnings.length = w0; xamls.length = x0; subtrees = s0;
    viaXaml(n, className, pkg, why, depth, at, sc);
  }

  function mappedCode(n: Node, className: string, pkg: string, depth: number, at: string, sc: Map<string, string>) {
    const m = maps.get(`${pkg}/${className}`);
    // 対応表が無い、対応表が「Coded API なし」（coded: null）、または Coded API の無いパッケージ（対応表の API を呼べない）なら、XAML 経由
    if (opt.viaXaml && (!m || m.coded === null || noApi.has(pkg))) return viaXaml(n, className, pkg, !m ? "対応表が無い" : m.coded === null ? `Coded API が無い（${m.reason}）` : "このパッケージの版に Coded API が無い", depth, at, sc);
    // 選んだ版が対応表の viaXamlBefore より前なら、XAML 経由（同じ API でも、その版では実行したときに落ちる）
    const ver = cat.versions[pkg];
    if (opt.viaXaml && m?.viaXamlBefore && ver && versionLess(ver, m.viaXamlBefore.version)) return viaXaml(n, className, pkg, `${pkg} ${ver} の Coded API では動かない（${m.viaXamlBefore.reason}）`, depth, at, sc);
    if (!m) { add(at, "NO_MAPPING", `${className} の対応表が無い（mappings/${pkg}/${className}.json を作る）`); return; }
    if (m.coded === null) { add(at, "NO_CODED_API", `${className} は Coded で書けない: ${m.reason}（${m.file}）`); return; }
    const given = [...Object.keys(n.props ?? {}), ...Object.keys(n.objs ?? {}), ...Object.keys(n.lists ?? {}), ...Object.keys(n.dicts ?? {})];
    // IR に無い props の意味は XAML と同じにする。generate.ts は既定 XAML の値を足すので、C# でもその値として扱う
    const act0 = resolve(cat, n.act, n.typeArg !== undefined);
    const xamlDefaults = "activity" in act0 ? xamlDefaultProps(cat, act0.activity) : {};
    const effective: Record<string, Value> = { ...xamlDefaults, ...(n.props ?? {}) };
    // "Prop" は IR にあること、"Prop=値" は props の値が等しいこと
    const whenIn = (names: string[], vals: Record<string, Value> | undefined) => (w: string) => {
      const eq = w.indexOf("=");
      return eq < 0 ? names.includes(w) : vals?.[w.slice(0, eq)] !== undefined && String(vals[w.slice(0, eq)]) === w.slice(eq + 1);
    };
    const whenOk = whenIn(given, n.props);
    const whenWithDefaults = whenIn([...given, ...Object.keys(xamlDefaults)], effective);
    // 形も既定値を含めて選ぶ（既定値を書いても書かなくても同じ形になるように）。ただし
    // 「API が無い」の形は IR に書かれたときだけ（既定値で選ぶと、そのアクティビティ全部が C# にできなくなる）、IR に書かれた値を扱えない形は選ばない
    const isReason = (x: Variant) => !x.call && !x.code && !x.special && !x.scope;
    const handlesGiven = (x: Variant) => {
      const text = JSON.stringify({ ...x, ignore: undefined });
      return given.every((k) => k === "ContinueOnError" || (m.ignore ?? []).includes(k) || (x.ignore ?? []).includes(k) || new RegExp(`\\b${k}\\b`).test(text));
    };
    const v = m.coded.find((x) => (isReason(x) ? (x.when ?? []).every(whenOk) : (x.when ?? []).every(whenWithDefaults) && handlesGiven(x))) ?? m.coded.find((x) => (x.when ?? []).every(whenOk));
    if (!v) { add(at, "NO_MAPPING", `${className} の対応表に、この props（${given.join(", ")}）に合う形が無い（${m.file}）`); return; }
    // この形だけ Coded API が無い（{ "when": ["ExistingWorkbook"], "reason": "..." }）
    if (v.reason && !v.call && !v.code && !v.special && !v.scope && opt.viaXaml) return viaXaml(n, className, pkg, `この形の Coded API が無い（${v.reason}）`, depth, at, sc);
    if (v.reason && !v.call && !v.code && !v.special && !v.scope) { add(at, "NO_CODED_API", `${className} は Coded で書けない: ${v.reason}（${m.file}）`); return; }
    // 引数の辞書（dicts）は、対応表が {Arguments|dict} で受けるか、ignore に書いたものだけ許す
    const tplRefs = new Set([...(v.code ? refs(v.code) : []), ...(v.call ? refs(v.call) : []), ...Object.values(v.init?.props ?? {}).flat().flatMap(refs), ...Object.values(v.args ?? {}).flatMap((t) => (typeof t === "string" ? refs(t) : Object.values(t.set).flatMap(refs)))]);
    for (const k of Object.keys(n.dicts ?? {})) if (!(m.ignore ?? []).concat(v.ignore ?? []).includes(k) && !tplRefs.has(k))
      add(`${at}.dicts.${k}`, "CODED_UNSUPPORTED", `${className}.${k}（引数の辞書）はまだ Coded に直せない`);
    for (const k of Object.keys(n.lists ?? {})) if (!(m.ignore ?? []).concat(v.ignore ?? []).includes(k) && !tplRefs.has(k))
      add(`${at}.lists.${k}`, "CODED_UNSUPPORTED", `${className}.${k}（式の一覧）を対応表（${m.file}）が扱っていない`);
    for (const u of v.usings ?? []) usings.add(u);

    if (v.special === "invokeWorkflow") return invoke(n, v, m, depth, at, sc);

    const act = resolve(cat, n.act, n.typeArg !== undefined);
    const adef = "activity" in act ? act.activity : undefined;
    // どの props を使ったか（使わなかった props は意味が落ちるのでエラー）
    const used = new Set<string>((m.ignore ?? []).concat(v.ignore ?? []));
    // IR の props に、既定 XAML の値と、対応表の defaults（どちらにも無いときの値）を足したもの
    const props: Record<string, Value> = { ...(v.defaults ?? {}), ...effective };
    const has = (r: string) => props[r] !== undefined || n.objs?.[r] !== undefined || n.dicts?.[r] !== undefined || n.lists?.[r] !== undefined;
    // 外側のスコープ（"scope": "using"）の変数。内側のものほど後ろにある
    const scopeVar = (t: string) => [...sc].reverse().find(([, ty]) => ty === t || ty.endsWith("." + t))?.[0];
    // テンプレートを使えるか（既定の無い参照が IR にそろい、{@型名} のスコープが外側にある）。使えなければその引数・行ごと省く
    const avail = (tpl: string) => requiredRefs(tpl).every(has) && scopeRefs(tpl).every((t) => scopeVar(t) !== undefined);
    const fill = (tpl: string) => {
      for (const r of refs(tpl)) used.add(r);
      for (const t of scopeRefs(tpl)) if (!scopeVar(t)) add(at, "CODED_SCOPE", `${className} は ${t} のスコープの中に置く（${m.file}）`);
      return tpl.replace(/\{@([\w.]+)\}/g, (_, t: string) => scopeVar(t) ?? "_").replace(/\{(\w+)(?:\|(\w+))?(?::-([^}]*))?\}/g, (_, name: string, filter?: string, dflt?: string) => {
        if (name === "typeArg") return n.typeArg ? csType(n.typeArg) : "object";
        if (name === "app") {
          // {app} は、いちばん内側の NApplicationCard（"special": "scope"）の変数。{@UiTargetApp} と同じ
          const app = scopeVar(UIA_APP_TYPE);
          if (!app) { add(at, "CODED_NO_SCOPE", `${className} の対応表は {app} を使うが、NApplicationCard の中に無い`); return "/* ? */ null"; }
          return app;
        }
        if (filter === "list") {
          // 式の一覧（IR の lists）→ C# の式をカンマで並べる（new T[] { {Items|list} } のように使う）
          const l = n.lists?.[name];
          if (!l) return dflt ?? "";
          return l.map((x, i) => expr(x, `${at}.lists.${name}[${i}]`, sc)).join(", ");
        }
        if (filter === "dict") {
          // 引数の辞書 → new Dictionary<string, object> { ["名前"] = 値, ... }（In だけ。Out / InOut は Coded に直せない）
          const d = n.dicts?.[name];
          if (!d) return dflt ?? "";
          for (const x of d) if (x.dir !== "In") add(`${at}.dicts.${name}.${x.name}`, "CODED_UNSUPPORTED", `${className}.${name} の ${x.dir} 引数は Coded に直せない`);
          const items = d.filter((x) => x.dir === "In").map((x) => `[${csLit(x.name)}] = ${expr(x.value, `${at}.dicts.${name}.${x.name}`, sc)}`);
          return `new Dictionary<string, object> { ${items.join(", ")} }`;
        }
        if (filter === "excelFilter" || filter === "excelFilterValues") {
          const fa = n.objs?.[name];
          if (!fa) return dflt ?? "";
          const ctx = { expr: (x: Value, xat: string) => expr(x, xat, sc), add };
          return filter === "excelFilter" ? excelFilterToCs(fa, `${at}.objs.${name}`, ctx) : excelFilterValuesToCs(fa, `${at}.objs.${name}`, ctx);
        }
        const pat = `${at}.props.${name}`;
        if (n.objs?.[name] !== undefined && adef && opt.descriptors) {
          const r = n.objs[name] as Record<string, unknown>;
          const ref = typeof r?.Reference === "string" ? r.Reference : (r?.Reference as { lit?: string } | undefined)?.lit;
          const d = ref ? opt.descriptors.get(ref) : undefined;
          if (d && (d.kind === "element" || d.kind === "screen")) {
            if (d.namespace) usings.add(`${d.namespace}.ObjectRepository`);
            if (d.kind === "screen") openedScreen = d.path;
            // 要素は、開いた画面の下のものでないと動かない（実行時に「Target name '…' is not part of the current screen.」）
            const scr = screens[screens.length - 1];
            if (d.kind === "element" && scr && !d.path.startsWith(scr + "."))
              warnings.push({ path: `${at}.objs.${name}`, code: "CODED_SCREEN_MISMATCH", message: `${d.path} は、開いた画面（${scr}）の要素ではない。実行時に「is not part of the current screen」で落ちる。その画面の下に同じ要素を作り、Reference をそちらにする` });
            return DESC + d.path;
          }
        }
        if (n.objs?.[name] !== undefined && adef) return objToCs(adef, name, n.objs[name], `${at}.objs.${name}`, { expr: (x, xat) => expr(x, xat, sc), add });
        const val = props[name];
        if (val === undefined) return dflt ?? "";
        // {Prop|type} … out の代入先の変数の型（C# の型名）
        if (filter === "type") {
          const t = typeof val === "string" ? (sc.get(val.trim()) ?? [...sc].find(([k]) => k.toLowerCase() === val.trim().toLowerCase())?.[1]) : undefined;
          return t ? csType(t) : "object";
        }
        // {Prop|is_Member} … enum の値が Member かどうか（"true" / "false"）
        if (filter?.startsWith("is_")) return String(val === filter.slice(3) || (typeof val === "boolean" && String(val) === filter.slice(3).toLowerCase()));
        const pdef = adef?.props.find((x) => x.name === name);
        if (pdef?.enum && typeof val === "string")
          return filter === "enum" ? val.split(",").map((x) => `${pdef.type}.${x.trim()}`).join(" | ") : val;
        if (pdef && (pdef.kind === "out" || pdef.kind === "inout")) return lvalue(val, pat, sc);
        return filter === "str" ? str(val, pat, sc) : expr(val, pat, sc);
      });
    };
    // args の値（文字列のテンプレートか、オプションのオブジェクト { new, set }）。使えないなら undefined（引数ごと省く）
    // テンプレートが参照するアクティビティの props の、Studio の日本語の名前（labels が無ければ undefined）
    const labelOf = (t: string): string | undefined => {
      if (!opt.labels) return undefined;
      const p = adef?.props.find((x) => x.name === refs(t)[0]);
      return p?.displayName ? opt.labels[p.displayName] : undefined;
    };
    const argText = (tpl: string | ObjArg): string | undefined => {
      if (typeof tpl === "string") return avail(tpl) ? fill(tpl) : undefined;
      // new したときの値と同じもの（ClickType = Single など）は書かない
      const kept = Object.entries(tpl.set).filter(([, t]) => refs(t).length > 0 && avail(t)).map(([k, t]) => [k, fill(t), t] as const)
        .filter(([k, x]) => !isOptionDefault(tpl.new, k, x));
      if (!kept.length) return tpl.always ? `new ${tpl.new}()` : undefined;
      if (!opt.labels) return `new ${tpl.new} { ${kept.map(([k, x]) => `${k} = ${x}`).join(", ")} }`;
      // 1行に1つ。行末に Studio の日本語の名前（テンプレートが参照するアクティビティの props の displayName）
      const body = kept.map(([k, x, t]) => { const j = labelOf(t); return `    ${k} = ${x},${j ? ` // ${j}` : ""}`; });
      return [`new ${tpl.new}`, "{", ...body, "}"].join(NL);
    };

    // ContinueOnError は、どのアクティビティでも try / catch で包む（式が真のときだけ例外を握りつぶす）
    const coe = n.props?.ContinueOnError;
    if (coe !== undefined) used.add("ContinueOnError");
    const cond = coe === undefined ? "false" : expr(coe, `${at}.props.ContinueOnError`, sc);
    const wrap = cond !== "false";
    const d = wrap ? depth + 1 : depth;
    if (wrap) { emit(depth, "try"); emit(depth, "{"); }

    // 子（body / slots）は scope と branches だけが使う。それ以外で書かれていたら意味が落ちる
    const slotsUsed = new Set<string>();
    if (v.code) for (const tl of v.code.split(/\r?\n/)) {
      // ひな形の行が「…呼び出し(名前: 値, 名前: 値, …)…;」で、日本語の名前があるなら、引数を1行に1つずつ書く（行末に // 名前）
      const sc0 = opt.labels ? splitCall(tl) : undefined;
      const named = sc0 && sc0.args.length >= 2 && sc0.args.every((a) => /^\w+:\s/.test(a)) && !ONE_LINE_CALLS.has(sc0.head.trim().split(/[\s=]+/).pop()!);
      const filled = named ? sc0!.args.map((a) => fill(a)) : [];
      if (!named || filled.some((x) => x.includes(NL))) { for (const l of fill(tl).split(/\r?\n/)) emit(d, l); continue; }
      emit(d, `${fill(sc0!.head)}(`);
      sc0!.args.forEach((a, i) => { const j = labelOf(a); emit(d, `    ${filled[i]}${i < filled.length - 1 ? "," : ""}${j ? ` // ${j}` : ""}`); });
      emit(d, `)${fill(sc0!.tail)}`);
    }
    else if (v.call) {
      // 子の設定から記述子を作る: 先に変数を作って子を実行し、それを引数に渡す
      if (v.scope === "collect") {
        const name = `__collect${++tmp}`;
        emit(d, `var ${name} = ${fill(v.collectInit ?? "null")};`);
        sc = new Map(sc).set(name, v.scopeType ?? "Object");
        block(n.body, d, `${at}.body`, sc);
        slotsUsed.add("body");
      }
      // メソッドの引数も、既定値と同じものは書かない（Log の level = Info など。coded-option-defaults.json の「<メソッド名>()」）
      const argPairs = Object.entries(v.args ?? {}).map(([param, tpl]) => [param, argText(tpl), tpl] as const)
        .filter(([param, t]) => t !== undefined && !(typeof t === "string" && !t.startsWith(DESC) && isOptionDefault(`${fill(v.call)}()`, param, t))) as (readonly [string, string, string | ObjArg])[];
      // Descriptors は引数名がメソッドで違う（target / elementDescriptor / screenDescriptor）ので、名前なしで先頭に置く
      // 引数ごとの Studio の日本語の名前（文字列のテンプレートの引数だけ。オプションのオブジェクトは中で1行ずつ付ける）
      const argList: { text: string; label?: string }[] = [
        ...argPairs.filter(([, t]) => t.startsWith(DESC)).map(([, t]) => ({ text: t.slice(DESC.length) })),
        ...argPairs.filter(([, t]) => !t.startsWith(DESC)).map(([param, t, tpl]) => ({ text: `${param}: ${t}`, label: typeof tpl === "string" ? labelOf(tpl) : undefined })),
      ];
      if (v.init) {
        // 引数 param に new Type { ... } を渡す。値が配列なら、使える最初のもの（Password と SecurePassword のどちらか、など）
        const members = Object.entries(v.init.props).map(([k, t]) => [k, (Array.isArray(t) ? t : [t]).find(avail)] as const)
          .filter(([, tpl]) => tpl !== undefined).map(([k, tpl]) => `${k} = ${fill(tpl!)}`);
        argList.push({ text: `${v.init.param}: new ${v.init.type} { ${members.join(", ")} }` });
      }
      const args = argList.map((a) => a.text);
      // 読みやすい形（labels があるとき）で、引数が2つ以上なら、引数を1行に1つずつ書く（1行の引数は行末に // 名前）。
      // 複数行の引数（1行に1つずつ書いたオプション）は、2行目からも1段深く字下げする
      // ただし Log(...) は短く読めるので、1行のまま（// 名前も付けない）
      const perLine = !!opt.labels && argList.length >= 2 && !ONE_LINE_CALLS.has(fill(v.call));
      const argLines = (a: { text: string; label?: string }, last: boolean) => {
        const ls = a.text.split(NL);
        const end = ls.length - 1;
        return ls.map((l, k) => `    ${l}${k === end && !last ? "," : ""}${k === end && end === 0 && a.label ? ` // ${a.label}` : ""}`);
      };
      const call = perLine
        ? [`${fill(v.call)}(`, ...argList.flatMap((a, i) => argLines(a, i === argList.length - 1)), ")"].join(NL)
        : `${fill(v.call)}(${args.join(", ")})`;
      if (v.returns) used.add(v.returns);
      const target = v.returns && n.props?.[v.returns] !== undefined ? lvalue(n.props[v.returns], `${at}.props.${v.returns}`, sc) : undefined;
      const us = usingScope(v);
      if (v.scope === "lambda") {
        const [item, index] = itemNames(n, 2);
        const slot = adef ? defaultSlot(adef) : undefined;
        const inner = new Map(sc).set(item, v.scopeType ?? (slot ? delegateArgs(slot, n.typeArg)?.[0] : undefined) ?? "Object");
        const exits = loopExits(n.body ?? [], at);
        exits.forEach((x) => lambdaExits.add(x));
        const isFunc = exits.length > 0;
        if (isFunc && !v.lambdaFuncArg) add(at, "CODED_UNSUPPORTED", `${className} の Break / Continue を対応表（${m.file}）が扱っていない（lambdaFuncArg が要る）`);
        const counter = index ? `__index${++tmp}` : undefined;
        if (counter) emit(d, `var ${counter} = 0;`); // XAML の番号は 1 始まり（run で確かめた）
        emit(d, `${fill(v.call)}(${[...args, `${isFunc ? v.lambdaFuncArg : v.lambdaArg}: ${item} =>`].join(", ")}`);
        emit(d, "{");
        if (counter) { emit(d + 1, `${counter}++;`); emit(d + 1, `int ${index} = ${counter};`); inner.set(index, "Int32"); }
        block(n.body, d + 1, `${at}.body`, inner);
        if (isFunc) emit(d + 1, "return true;");
        emit(d, "});");
        slotsUsed.add("body");
      } else if (us) {
        // スコープ: using (var <変数> = call) { body }。子からは {@scopeType の末尾}（NApplicationCard なら {app}）で参照する
        //   変数名は、varPrefix があれば <varPrefix><連番>（NApplicationCard の app1）、無ければ IR の item（Excel の Use Excel File など）
        //   CloseMode などは Dispose で効く
        const slot = adef ? defaultSlot(adef) : undefined;
        const name = us.varPrefix ? `${us.varPrefix}${++tmp}` : itemNames(n, 1)[0];
        const type = us.type ?? (slot ? delegateArgs(slot, n.typeArg)?.[0] : undefined) ?? "Object";
        emit(d, `using (var ${name} = ${call})`);
        const pushed = openedScreen !== undefined;
        if (pushed) screens.push(openedScreen!);
        openedScreen = undefined;
        braces(d, () => block(n.body, d + 1, `${at}.body`, new Map(sc).set(name, type)));
        if (pushed) screens.pop();
        slotsUsed.add("body");
      } else if (v.branches) {
        const r = `__state${++tmp}`;
        emit(d, `var ${r} = ${call};`);
        if (target) emit(d, `${target} = ${r};`);
        const t = v.branches.true, f = v.branches.false;
        emit(d, `if (${r})`);
        braces(d, () => block(t ? n.slots?.[t] : undefined, d + 1, `${at}.slots.${t}`, sc));
        if (f && n.slots?.[f]?.length) { emit(d, "else"); braces(d, () => block(n.slots![f], d + 1, `${at}.slots.${f}`, sc)); }
        if (t) slotsUsed.add(t);
        if (f) slotsUsed.add(f);
      } else emit(d, target ? `${target} = ${call};` : `${call};`);
    } else add(at, "BAD_MAPPING", `${m.file}: call か code が要る`);
    if (n.body?.length && !slotsUsed.has("body")) add(`${at}.body`, "CODED_UNSUPPORTED", `${className} の body を対応表（${m.file}）が扱っていない`);
    for (const k of Object.keys(n.slots ?? {})) if (!slotsUsed.has(k) && !(m.ignore ?? []).includes(k))
      add(`${at}.slots.${k}`, "CODED_UNSUPPORTED", `${className}.${k}（子）を対応表（${m.file}）が扱っていない`);
    for (const k of given) if (!used.has(k) && k !== "DisplayName")
      add(`${at}.props.${k}`, "MAPPING_UNUSED_PROP", `${className}.${k} を対応表（${m.file}）が扱っていない。args${v.init ? " か init" : ""} に足すか、意味がなければ ignore に書く`);
    if (!wrap) return;
    emit(depth, "}");
    emit(depth, cond === "true" ? "catch (Exception)" : `catch (Exception) when (${cond})`);
    braces(depth, () => emit(depth + 1, `// ContinueOnError: ${className} の例外を無視する`));
  }

  // ラムダの本体にある、そのラムダを抜ける Break / Continue。内側のループの中のものは数えない。Return はラムダの中では書けない
  function loopExits(nodes: Node[], at: string): Node[] {
    const out: Node[] = [];
    const walk = (c: Node, cat_at: string) => {
      const r = resolve(cat, c.act, c.typeArg !== undefined);
      if ("error" in r) return;
      const name = r.activity.className;
      if (name === "Return" && isBuiltin(r.activity.clrType)) add(cat_at, "CODED_UNSUPPORTED", "ラムダ（Excel の繰り返し）の中の Return は Coded に直せない");
      if ((name === "Break" || name === "Continue") && isBuiltin(r.activity.clrType)) { out.push(c); return; }
      const isLoop = isBuiltin(r.activity.clrType)
        ? ["ForEach", "ForEachRow", "While", "DoWhile", "ParallelForEach", "RepeatNumberOfTimesX", "InterruptibleWhile", "InterruptibleDoWhile", "RetryScope"].includes(name)
        : !!maps.get(`${r.activity.package}/${name}`)?.coded?.some((x) => x.scope === "lambda");
      if (isLoop) return;
      const kids = [...(c.body ?? []), ...(c.then ?? []), ...(c.else ?? []), ...Object.values(c.slots ?? {}).flat(), ...Object.values(c.cases ?? {}).flat(), ...(c.catches ?? []).flatMap((x) => x.body)];
      kids.forEach((k) => walk(k, cat_at));
    };
    nodes.forEach((c, i) => walk(c, `${at}.body[${i}]`));
    return out;
  }

  // 部分木だけを置いた XAML を作り、RunWorkflow で呼ぶ。書き込まれる変数（InOut）は戻りの辞書から戻す
  function viaXaml(n: Node, className: string, pkg: string, why: string, depth: number, at: string, sc: Map<string, string>) {
    const dir = opt.viaXaml!.dir.replace(/\\/g, "/").replace(/^\/+|\/+$/g, "");
    // 子の無いノードは、1つのアクティビティだけの汎用の XAML（_activities/）。値は C# から引数で渡す
    const g = genericActivity(n, cat, sc);
    if (g && !validate(g.wf, cat).length) return viaActivity(n, g, className, pkg, why, depth, at, sc, dir);
    const name = `${wf.workflow}_${subtrees++ + 1}`;
    const path = dir ? `${dir}/${name}.xaml` : `${name}.xaml`;
    const r = viaXamlArgs(n, cat, sc);
    for (const i of r.issues) add(at, i.code, i.message);
    const sub = viaXamlWorkflow(n, name, r.args);
    // その位置から外したことで足りなくなるもの（UI のスコープの外、Excel のスコープの外など）は、ここで分かる
    for (const i of validate(sub, cat)) add(at, "CODED_VIA_XAML_INVALID", `XAML 経由（${path}）にすると検証を通らない: ${i.code} ${i.path}: ${i.message}`);
    xamls.push({ path, wf: sub, at, kind: "subtree" });
    warnings.push({ path: at, code: "CODED_VIA_XAML", message: `${className}（${pkg}）は${why}ので、XAML（${path}）にして RunWorkflow で呼ぶ` });
    emit(depth, `// ${className} は${why}ので XAML 経由（${path}）`);
    const items = r.args.map((x) => `[${csLit(x.name)}] = ${x.name}`);
    const dict = items.length ? `new Dictionary<string, object> { ${items.join(", ")} }` : "null";
    const back = r.args.filter((x) => x.dir === "InOut");
    if (!back.length) { emit(depth, `RunWorkflow(${csLit(path)}, ${dict});`); return; }
    const v = `__xaml${++tmp}`;
    emit(depth, `var ${v} = RunWorkflow(${csLit(path)}, ${dict});`);
    for (const x of back) emit(depth, `${x.name} = (${csType(x.type)})${v}[${csLit(x.name)}];`);
  }

  // _activities/<名前>.xaml を RunWorkflow で呼ぶ。IR の値は引数の辞書で渡し、出力は戻りの辞書から受ける
  function viaActivity(_n: Node, g: GenericActivity, className: string, pkg: string, why: string, depth: number, at: string, sc: Map<string, string>, dir: string) {
    const actDir = dir.replace(/(^|\/)_xaml$/, "$1_activities");
    const path = actDir === dir ? `${dir}/_activities/${g.name}.xaml`.replace(/^\//, "") : `${actDir}/${g.name}.xaml`;
    if (!xamls.some((x) => x.path === path)) xamls.push({ path, wf: g.wf, at, kind: "activity" });
    warnings.push({ path: at, code: "CODED_VIA_XAML", message: `${className}（${pkg}）は${why}ので、1つのアクティビティだけの XAML（${path}）を RunWorkflow で呼ぶ` });
    emit(depth, `// ${className} は${why}ので XAML 経由（${path}）`);
    const given = g.args.filter((x): x is typeof x & { value: Value } => x.value !== undefined); // IR に無い出力・入出力は渡さず、受け取らない
    const items = given.filter((x) => x.dir !== "Out").map((x) => `[${csLit(x.name)}] = ${/^(System\.)?String$/.test(x.type) ? str(x.value, at, sc) : expr(x.value, at, sc)}`);
    const dict = items.length ? `new Dictionary<string, object> { ${items.join(", ")} }` : "null";
    const back = given.filter((x) => x.dir !== "In");
    if (!back.length) { emit(depth, `RunWorkflow(${csLit(path)}, ${dict});`); return; }
    const v = `__xaml${++tmp}`;
    emit(depth, `var ${v} = RunWorkflow(${csLit(path)}, ${dict});`);
    for (const x of back) emit(depth, `${lvalue(x.value, at, sc)} = (${csType(x.type)})${v}[${csLit(x.name)}];`);
  }

  function invoke(n: Node, _v: Variant, m: Mapping, depth: number, at: string, sc: Map<string, string>) {
    const p = n.props ?? {};
    const fileV = p.WorkflowFileName;
    let file = expr(fileV, `${at}.props.WorkflowFileName`, sc);
    if (typeof fileV === "object" && "lit" in fileV && opt.invokePath) file = csLit(opt.invokePath(fileV.lit));
    const toCoded = /\.cs"$/.test(file);
    const known = new Set(["WorkflowFileName", "Timeout", "DisplayName", ...(m.ignore ?? [])]);
    for (const k of Object.keys(p)) if (!known.has(k)) add(`${at}.props.${k}`, "MAPPING_UNUSED_PROP", `InvokeWorkflowFile.${k} はまだ Coded に直せない`);
    const inArgs = (n.args ?? []).filter((x) => x.dir === "In").map((x) => `["${x.name}"] = ${expr(x.value, `${at}.args.${x.name}`, sc)}`);
    const outArgs = (n.args ?? []).filter((x) => x.dir !== "In");
    if ((n.args ?? []).some((x) => x.dir === "InOut")) add(`${at}.args`, "CODED_INOUT", "InOut 引数の受け渡しはまだ Coded に直せない");
    const dict = inArgs.length ? `new Dictionary<string, object> { ${inArgs.join(", ")} }` : "null";
    const timeout = p.Timeout !== undefined ? `, timeout: ${expr(p.Timeout, `${at}.props.Timeout`, sc)}` : "";
    if (!outArgs.length) { emit(depth, `RunWorkflow(${file}, ${dict}${timeout});`); return; }
    const r = `__result${++tmp}`;
    emit(depth, `var ${r} = RunWorkflow(${file}, ${dict}${timeout});`);
    // Coded のワークフローは、Out が1つだと引数名が "Output" になる
    for (const x of outArgs) {
      const key = toCoded && outArgs.length === 1 ? "Output" : x.name;
      emit(depth, `${lvalue(x.value, `${at}.args.${x.name}`, sc)} = (${csType(x.type)})${r}["${key}"];`);
    }
  }
}

function csLit(s: string): string {
  return '"' + s.replace(/\\/g, "\\\\").replace(/"/g, '\\"').replace(/\r/g, "\\r").replace(/\n/g, "\\n").replace(/\t/g, "\\t") + '"';
}
