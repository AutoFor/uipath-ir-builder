// 検証済みの IR から XAML を作る。XAML の書式はすべてここで決める。

import type { Catalog, Activity, Prop } from "./catalog.ts";
import { funcInfo, funcArgName, resolve, defaultSlot, delegateArgs, isArgumentList, argumentListElement, listElementType, objectTypes, plainListElement, literalMapValue } from "./catalog.ts";
import type { Workflow, Node, Value, VariableDecl, InvokeArg, Issue } from "./types.ts";
import { toXamlType } from "./types-xaml.ts";
import { isUntypedArgument, argumentType, itemNames, isValueItem } from "./validate.ts";
import { prepareUia, emitObjs, nextGuid, contentGuid, resetGuids } from "./uia.ts";
import { excelPrefixes, excelVbForCs } from "./excel.ts";
import { formLayoutLiteral } from "./persistence.ts";
import { vbToCs, vbDefaultToCs, csKeywords } from "./vb2cs.ts";

const ACTIVITIES_NS = "http://schemas.microsoft.com/netfx/2009/xaml/activities";
const knownPrefixes: Record<string, string> = {
  [ACTIVITIES_NS]: "",
  "http://schemas.uipath.com/workflow/activities": "ui",
  "http://schemas.uipath.com/workflow/activities/uix": "uix",
  "clr-namespace:System.Collections.Generic;assembly=System.Private.CoreLib": "scg",
  ...excelPrefixes,
  // Testing（Studio の既定 XAML と同じ接頭辞）
  "clr-namespace:UiPath.Testing.Activities;assembly=UiPath.Testing.Activities": "uta",
  "clr-namespace:UiPath.Testing.Activities.Coverage;assembly=UiPath.Testing.Activities": "utac",
  "clr-namespace:UiPath.Testing.Activities.Mocks;assembly=UiPath.Testing.Activities": "utam",
  "clr-namespace:UiPath.Testing.Activities.TestData;assembly=UiPath.Testing.Activities": "utat",
};

// Studio の BlankTemplate の Main.xaml と同じ並び
const baseImports = [
  "System.Activities", "System.Activities.Statements", "System.Activities.Expressions", "System.Activities.Validation",
  "System.Activities.XamlIntegration", "Microsoft.VisualBasic", "Microsoft.VisualBasic.Activities", "System",
  "System.Collections", "System.Collections.Generic", "System.Collections.ObjectModel", "System.Data", "System.Diagnostics",
  "System.Drawing", "System.IO", "System.Linq", "System.Net.Mail", "System.Xml", "System.Xml.Linq", "UiPath.Core",
  "UiPath.Core.Activities", "System.Windows.Markup",
];
const baseRefs = [
  "System.Activities", "Microsoft.VisualBasic", "System.Private.CoreLib", "mscorlib", "System.Data", "System", "System.Linq",
  "System.Data.Common", "System.Drawing", "System.Drawing.Primitives", "System.Drawing.Common", "System.Core", "System.Xml",
  "System.Xml.Linq", "PresentationFramework", "WindowsBase", "PresentationCore", "System.Xaml", "UiPath.System.Activities",
  "UiPath.UiAutomation.Activities", "System.Data.DataSetExtensions", "System.Net.Mail",
];

// 式の言語が C# の BlankTemplate の Main.xaml と同じ並び（Studio 26.10 で作ったもの。System.Text と Microsoft.CSharp などが増える）。
// 重複も Studio のまま（Set で1つになる）
const baseImportsCs = [...baseImports.slice(0, baseImports.indexOf("System.Xml") + 1), "System.Text", ...baseImports.slice(baseImports.indexOf("System.Xml") + 1)];
const baseRefsCs = [
  "Microsoft.CSharp", "System", "System.Linq", "System.Core", "System.Activities", "System.Data", "System.Data.Common", "System.Runtime.Serialization",
  "System.ServiceModel", "System.ServiceModel.Activities", "System.Xaml", ...baseRefs,
];
const MCA = "clr-namespace:Microsoft.CSharp.Activities;assembly=System.Activities";

export type ExpressionLanguage = "VisualBasic" | "CSharp";

// Windows でしか使えない AssemblyReference（WPF）。Studio 26.10 の空のプロジェクトでは、クロスプラットフォーム（Portable）の Main.xaml にこの 3 つが無い。
// ほかの imports / AssemblyReference は同じ（VB では System.Data.Common の位置だけ System.Data の後ろに変わる）
export const WINDOWS_ONLY_REFS = ["PresentationFramework", "WindowsBase", "PresentationCore"];

// ルートの AssemblyReference を、その実行環境に合わせる。Portable は WPF の参照を外す。
// Windows は、無ければ System.Xml.Linq の後ろに足す（Studio の空のプロジェクトの並び。migrate-platform.ts が Portable から移すとき）
export function refsForPlatform(refs: string[], platform: "Windows" | "Portable"): string[] {
  if (platform === "Portable") return refs.filter((r) => !WINDOWS_ONLY_REFS.includes(r));
  const missing = WINDOWS_ONLY_REFS.filter((r) => !refs.includes(r));
  if (!missing.length) return refs;
  const i = refs.indexOf("System.Xml.Linq");
  return i < 0 ? [...refs, ...missing] : [...refs.slice(0, i + 1), ...missing, ...refs.slice(i + 1)];
}

// BlankTemplate のルートの imports / AssemblyReference（式の言語と実行環境ごと）
export function templateRootImports(language: ExpressionLanguage = "VisualBasic", platform: "Windows" | "Portable" = "Windows"): { imports: string[]; refs: string[] } {
  const t = language === "CSharp" ? { imports: [...baseImportsCs], refs: [...new Set(baseRefsCs)] } : { imports: [...baseImports], refs: [...baseRefs] };
  if (platform === "Windows") return t;
  let refs = refsForPlatform(t.refs, platform);
  if (language === "VisualBasic") { refs = refs.filter((r) => r !== "System.Data.Common"); refs.splice(refs.indexOf("System.Data") + 1, 0, "System.Data.Common"); }
  return { imports: t.imports, refs };
}

// rootImports：ルートの imports / AssemblyReference の元（対象プロジェクトの既存 XAML から読んだもの。versions.ts）。無ければ BlankTemplate の並び
// language：式の言語（project.json の expressionLanguage）。既定は VisualBasic
export type GenerateOptions = { rootImports?: { imports: string[]; refs: string[] }; language?: ExpressionLanguage };

// C# の式に直せない値があれば Error にする（gen.ts は generateChecked の issues を検証エラーとして出す）
export function generate(wf: Workflow, cat: Catalog, opts: GenerateOptions = {}): string {
  const r = generateChecked(wf, cat, opts);
  if (r.issues.length) throw new Error(r.issues.map((i) => `${i.code} ${i.path}: ${i.message}`).join("\n"));
  return r.xaml;
}

// issues は C# の式に直せなかったもの（VB では常に空）
export function generateChecked(wf: Workflow, cat: Catalog, opts: GenerateOptions = {}): { xaml: string; issues: Issue[] } {
  resetGuids(wf.workflow);
  const cs = opts.language === "CSharp";
  const issues: Issue[] = [];
  const paths = new WeakMap<Node, string>(); // ノードの IR の中の場所（エラーの表示用）
  const xmlns = new Map<string, string>(); // prefix -> uri
  const imports = new Set(opts.rootImports?.imports ?? (cs ? baseImportsCs : baseImports));
  const refs = new Set(opts.rootImports?.refs ?? (cs ? baseRefsCs : baseRefs));
  const ids = new Map<string, number>();
  const lines: string[] = [];
  let extra = 0;

  const prefixFor = (uri: string) => {
    let p = knownPrefixes[uri];
    if (p === undefined) p = [...xmlns].find(([, u]) => u === uri)?.[0] ?? `ns${extra++}`;
    if (p) xmlns.set(p, uri);
    return p ? `${p}:` : "";
  };
  const typeText = (t: string) => {
    const r = toXamlType(t);
    if ("error" in r) throw new Error(r.error); // validate 済みなら来ない
    for (const [p, u] of Object.entries(r.xmlns)) xmlns.set(p, u);
    // Data Fabric の表の型は Studio が entitiesStores から作るアセンブリにある。式から使えるよう参照と import を足す
    if (r.xmlns.de) { refs.add("DataService.DataService.Entities"); imports.add("DataService.Entities"); }
    return r.text;
  };
  const idRef = (cls: string) => {
    const n = (ids.get(cls) ?? 0) + 1;
    ids.set(cls, n);
    return `${cls}_${n}`;
  };
  const emit = (depth: number, s: string) => lines.push("  ".repeat(depth) + s);

  // ---- 式 ----
  // C# の式にする。{ vb, cs } は cs をそのまま、素の文字列（VB）は vb2cs.ts で直す。直せないときは issues に積む（推測で書かない）。
  // type を渡すと変数の既定値として直す（{a, b} を配列にする）
  const csText = (v: Value, scope: Map<string, string>, at: string, type?: string): string => {
    if (typeof v === "number") return String(v);
    if (typeof v === "boolean") return v ? "true" : "false";
    if (typeof v === "object") return "lit" in v ? csLit(v.lit) : v.cs;
    const vb = excelVbForCs(v, scope);
    const r = type !== undefined ? vbDefaultToCs(vb, type, scope, { tree: true }) : vbToCs(vb, scope, { tree: true });
    if (!("error" in r)) return r.cs;
    issues.push({ path: at, code: "CS_EXPR", message: `式 ${JSON.stringify(v)} を C# に直せない: ${r.error}。{ "vb": "...", "cs": "..." } で両方を書く` });
    return v;
  };
  // 引数の要素（<InArgument> など）の中身。VB は [式]、C# は <mca:CSharpValue> / <mca:CSharpReference>（t は XAML の型表記）
  const argBody = (v: Value, t: string, ref: boolean, scope: Map<string, string>, at: string): string => {
    if (!cs) return esc(`[${ref ? String(v) : exprText(v)}]`);
    xmlns.set("mca", MCA);
    const k = ref ? "CSharpReference" : "CSharpValue";
    return `<mca:${k} x:TypeArguments="${t}">${esc(csText(v, scope, at))}</mca:${k}>`;
  };
  // C# で属性に書けない値（式）を、プロパティの型の要素にする。属性に書けるなら undefined。
  // p はカタログのプロパティ（in / out / inout は T、child は Activity<T>）。型引数（T、TResult など）は typeArg に置き換える
  const csElement = (v: Value, p: Prop, typeArg: string | undefined, scope: Map<string, string>, at: string): string | undefined => {
    if (!cs || literalAttr(v, p) !== undefined) return undefined;
    const inner = p.kind === "child" ? p.type.match(/^System\.Activities\.Activity<(.+)>$/)?.[1] ?? "System.Object" : p.type;
    const t = typeText(inner.replace(/\bT(?:[A-Z]\w*)?\b/g, typeArg ?? "Object"));
    if (p.kind === "child") return argBody(v, t, false, scope, at); // While.Condition などは CSharpValue をそのまま置く
    const dir = p.kind === "out" ? "OutArgument" : p.kind === "inout" ? "InOutArgument" : "InArgument";
    return `<${dir} x:TypeArguments="${t}">${argBody(v, t, p.kind !== "in", scope, at)}</${dir}>`;
  };
  // 子のノードの場所を覚える（もう決まっていれば変えない）
  // C# の予約語の名前（out など）は C# の XAML で参照できない（@out も CS0103）
  const csName = (name: string, path: string) => { if (cs && csKeywords.has(name)) issues.push({ path, code: "CS_NAME", message: `名前 ${name} は C# の予約語なので、C# の XAML では使えない。名前を変える` }); };
  const at = (n: Node, path: string) => { if (!paths.has(n)) paths.set(n, path); return n; };
  const sub = (base: string, k: string) => (base ? `${base}.${k}` : k);

  // ルートは Sequence 1つにまとめる（ワークフローの変数はそこに付ける）
  const root: Node =
    wf.body.length === 1 && wf.body[0].act === "Sequence"
      ? { ...wf.body[0], variables: [...(wf.variables ?? []), ...(wf.body[0].variables ?? [])] }
      : { act: "Sequence", name: wf.workflow, variables: wf.variables, body: wf.body };

  const scope = new Map((wf.arguments ?? []).map((a) => [a.name, a.type] as [string, string]));
  emitNode(at(prepareUia(root, cat), wf.body.length === 1 && wf.body[0].act === "Sequence" ? "body[0]" : ""), 1, scope);
  const body = lines.splice(0);

  // ルート要素
  (wf.arguments ?? []).forEach((a, i) => csName(a.name, `arguments[${i}]`));
  const members = (wf.arguments ?? []).map(
    (a) => `    <x:Property Name="${esc(a.name)}" Type="${a.dir}Argument(${typeText(a.type)})" />`,
  );
  const allNs: [string, string][] = [
    ["", ACTIVITIES_NS],
    ["mc", "http://schemas.openxmlformats.org/markup-compatibility/2006"],
    ...(cs ? [] : [["mva", "clr-namespace:Microsoft.VisualBasic.Activities;assembly=System.Activities"] as [string, string]]),
    ["sap", "http://schemas.microsoft.com/netfx/2009/xaml/activities/presentation"],
    ["sap2010", "http://schemas.microsoft.com/netfx/2010/xaml/activities/presentation"],
    ["sco", "clr-namespace:System.Collections.ObjectModel;assembly=mscorlib"],
    ...[...xmlns].filter(([p]) => !["", "mc", "mva", "sap", "sap2010", "sco", "x"].includes(p)).sort(),
    ["x", "http://schemas.microsoft.com/winfx/2006/xaml"],
  ];
  const out: string[] = [];
  // C# は Studio と同じく ExpressionActivityEditor="C#" を付け、VisualBasic.Settings は書かない
  out.push(`<Activity mc:Ignorable="sap sap2010" x:Class="${esc(wf.workflow)}" ${cs ? 'sap2010:ExpressionActivityEditor.ExpressionActivityEditor="C#"' : 'mva:VisualBasic.Settings="{x:Null}"'}`);
  for (const [p, u] of allNs) out.push(`xmlns${p ? ":" + p : ""}="${u}"${p === "x" ? ">" : ""}`);
  if (members.length) out.push("  <x:Members>", ...members, "  </x:Members>");
  out.push("  <TextExpression.NamespacesForImplementation>", '    <sco:Collection x:TypeArguments="x:String">');
  for (const i of imports) out.push(`      <x:String>${esc(i)}</x:String>`);
  out.push("    </sco:Collection>", "  </TextExpression.NamespacesForImplementation>");
  out.push("  <TextExpression.ReferencesForImplementation>", '    <sco:Collection x:TypeArguments="AssemblyReference">');
  for (const r of refs) out.push(`      <AssemblyReference>${esc(r)}</AssemblyReference>`);
  out.push("    </sco:Collection>", "  </TextExpression.ReferencesForImplementation>");
  out.push(...body, "</Activity>", "");
  return { xaml: out.join("\r\n"), issues };

  function emitNode(n: Node, depth: number, scope: Map<string, string>, key?: string) {
    const r = resolve(cat, n.act, n.typeArg !== undefined);
    if ("error" in r) throw new Error(r.error);
    const a = r.activity;
    const tag = prefixFor(a.xmlns) + a.className;
    const ns = a.clrType.slice(0, a.clrType.lastIndexOf("."));
    imports.add(ns);
    refs.add(a.assembly);
    for (const v of n.variables ?? []) scope.set(v.name, v.type);
    const here = paths.get(n) ?? "";

    // 属性
    const attrs: [string, string][] = [];
    if (a.genericArity > 0) attrs.push(["x:TypeArguments", typeText(n.typeArg ?? "Object")]);
    if (key !== undefined) attrs.push(["x:Key", key]);
    if (n.name) attrs.push(["DisplayName", n.name]);
    const elems: { prop: Prop; value: Value }[] = [];
    const csElems: [string, string][] = []; // C# で要素にした式（プロパティ名、要素）
    for (const [k, v] of Object.entries(n.props ?? {})) {
      const p = a.props.find((p) => p.name === k)!;
      if (isUntypedArgument(p.type)) elems.push({ prop: p, value: v });
      else if (p.type === "System.Type") attrs.push([k, `{x:Type ${typeText(String(v))}}`]);
      else if (p.enumConverter && typeof v === "string" && p.enum?.includes(v)) {
        // 表示名で読む TypeConverter がある enum（Testing の VerificationType など）。名前を書くと読めず既定値になるので、値を直接渡す
        const dot = p.type.lastIndexOf(".");
        attrs.push([k, `{x:Static ${prefixFor(`clr-namespace:${p.type.slice(0, dot)};assembly=${p.enumAssembly}`)}${p.type.slice(dot + 1)}.${v}}`]);
      } else {
        const el = csElement(v, p, n.typeArg, scope, sub(here, `props.${k}`));
        if (el !== undefined) csElems.push([k, el]);
        else attrs.push([k, attrValue(v, p)]);
      }
    }
    // get-default-xaml に出た既定値のうち、IR が書いていないもの（Version=V5 など）
    for (const [k, v] of Object.entries(cat.defaults.get(a.className) ?? {})) {
      if (attrs.some(([x]) => x === k) || csElems.some(([x]) => x === k) || !a.props.some((p) => p.name === k)) continue;
      // 既定値が VB の式（[...]）のもの。C# では直して要素にする
      if (cs && /^\[[\s\S]*\]$/.test(v)) {
        const el = csElement(v.slice(1, -1), a.props.find((p) => p.name === k)!, n.typeArg, scope, `${sub(here, `props.${k}`)}（get-default-xaml の既定値）`);
        if (el !== undefined) { csElems.push([k, el]); continue; }
      }
      // FormLayoutGuid は、同じ値だとテナントが最初のレイアウトを使い続ける（AUT-1076）。リテラルのレイアウトは中身も混ぜて決める
      const layout = a.className === "CreateFormTask" && k === "FormLayoutGuid" ? formLayoutLiteral(n.props?.FormLayout) : undefined;
      if (!/^[0-9a-f]{8}-[0-9a-f]{4}-/.test(v)) attrs.push([k, v]);
      else { const g = nextGuid(); attrs.push([k, layout !== undefined ? contentGuid(layout) : g]); }
    }
    const first = (k: string) => (k === "x:TypeArguments" ? 0 : k === "x:Key" ? 1 : 2);
    attrs.sort(([x], [y]) => first(x) - first(y) || x.localeCompare(y));
    attrs.push(["sap2010:WorkflowViewState.IdRef", idRef(a.className)]);
    const attrText = attrs.map(([k, v]) => ` ${k}="${esc(v)}"`).join("");

    // 子
    const slots: [Prop, Node[]][] = [];
    const slotOf = (name: string) => a.props.find((p) => p.name === name)!;
    const mark = (nodes: Node[], path: string) => { nodes.forEach((c, i) => at(c, sub(here, `${path}[${i}]`))); return nodes; };
    if (n.body) slots.push([defaultSlot(a)!, mark(n.body, "body")]);
    if (n.then) slots.push([slotOf("Then"), mark(n.then, "then")]);
    if (n.else) slots.push([slotOf("Else"), mark(n.else, "else")]);
    for (const [k, v] of Object.entries(n.slots ?? {})) slots.push([slotOf(k), mark(v, `slots.${k}`)]);
    n.catches?.forEach((c, i) => mark(c.body, `catches[${i}].body`));
    for (const [k, v] of Object.entries(n.cases ?? {})) mark(v, `cases.${k}`);

    const hasContent =
      elems.length || csElems.length || slots.length || Object.keys(n.objs ?? {}).length || n.variables?.length || n.args?.length || Object.keys(n.dicts ?? {}).length || Object.keys(n.lists ?? {}).length || n.cases || n.catches?.length || n.assigns?.length;
    if (!hasContent) { emit(depth, `<${tag}${attrText} />`); return; }
    emit(depth, `<${tag}${attrText}>`);

    const dicts: [string, InvokeArg[]][] = [...(n.args?.length ? [["Arguments", n.args] as [string, InvokeArg[]]] : []), ...Object.entries(n.dicts ?? {})];
    for (const [prop, list] of dicts) {
      const mapValue = literalMapValue(a.props.find((x) => x.name === prop)?.type ?? "");
      if (mapValue) {
        // IDictionary<String, String> は <x:String x:Key="k">値</x:String>、Dictionary<String, InArgument<String>> は <InArgument x:Key="k">[式]</InArgument>
        const sg = prefixFor("clr-namespace:System.Collections.Generic;assembly=System.Private.CoreLib");
        emit(depth + 1, `<${tag}.${prop}>`);
        emit(depth + 2, `<${sg}Dictionary x:TypeArguments="x:String, ${mapValue === "String" ? "x:String" : "InArgument(x:String)"}">`);
        for (const x of list) {
          if (mapValue === "String") emit(depth + 3, `<x:String x:Key="${esc(x.name)}">${esc((x.value as { lit: string }).lit)}</x:String>`);
          else emit(depth + 3, `<InArgument x:TypeArguments="x:String" x:Key="${esc(x.name)}">${argBody(x.value, "x:String", false, scope, sub(here, `dicts.${prop}.${x.name}`))}</InArgument>`);
        }
        emit(depth + 2, `</${sg}Dictionary>`);
        emit(depth + 1, `</${tag}.${prop}>`);
        continue;
      }
      // 辞書のプロパティ。Studio の既定 XAML と同じく <scg:Dictionary> で包む（プロパティが null で始まるアクティビティもあるため）。
      // InvokeWorkflowFile（args）だけは、run で確かめた包まない形のまま
      const wrap = !(n.args?.length && prop === "Arguments");
      const p = a.props.find((x) => x.name === prop);
      const valueType = /InArgument>$/.test(p?.type ?? "") ? "InArgument" : "Argument";
      if (wrap) xmlns.set("scg", "clr-namespace:System.Collections.Generic;assembly=System.Private.CoreLib");
      emit(depth + 1, `<${tag}.${prop}>`);
      if (wrap) emit(depth + 2, `<scg:Dictionary x:TypeArguments="x:String, ${valueType}">`);
      for (const x of list) {
        const t = typeText(x.type);
        const v = argBody(x.value, t, x.dir !== "In", scope, sub(here, `${n.args?.length && prop === "Arguments" ? "args" : `dicts.${prop}`}.${x.name}`));
        emit(depth + (wrap ? 3 : 2), `<${x.dir}Argument x:TypeArguments="${t}" x:Key="${esc(x.name)}">${v}</${x.dir}Argument>`);
      }
      if (wrap) emit(depth + 2, `</scg:Dictionary>`);
      emit(depth + 1, `</${tag}.${prop}>`);
    }
    // lists はプロパティの型で振り分ける。
    // InArgument<T> の一覧は要素の型が決まっている。それ以外の List<T> は、要素が素の InArgument なら
    // <InArgument x:TypeArguments="x:String">[式]</InArgument>、オブジェクト型なら <ui:FilterOperationArgument 属性...> と、式のプロパティは子要素（InArgument は x:String）
    for (const [prop, list] of Object.entries(n.lists ?? {})) {
      const p = a.props.find((x) => x.name === prop)!;
      if (isArgumentList(p.type)) {
        // List<InArgument<T>> / IEnumerable<InArgument<T>>。Studio の既定 XAML と同じく <scg:List x:TypeArguments="InArgument(T)"> に要素を並べる
        const t = typeText(argumentListElement(p.type, n.typeArg)!);
        xmlns.set("scg", "clr-namespace:System.Collections.Generic;assembly=System.Private.CoreLib");
        emit(depth + 1, `<${tag}.${prop}>`);
        if (list.length === 0) emit(depth + 2, `<scg:List x:TypeArguments="InArgument(${t})" Capacity="0" />`);
        else {
          emit(depth + 2, `<scg:List x:TypeArguments="InArgument(${t})" Capacity="${Math.max(4, list.length)}">`);
          list.forEach((v, i) => emit(depth + 3, `<InArgument x:TypeArguments="${t}">${argBody(v as Value, t, false, scope, sub(here, `lists.${prop}[${i}]`))}</InArgument>`));
          emit(depth + 2, `</scg:List>`);
        }
        emit(depth + 1, `</${tag}.${prop}>`);
        continue;
      }
      const plain = plainListElement(p.type);
      if (plain) {
        // List<String> は <scg:List x:TypeArguments="x:String"><x:String>値</x:String></scg:List>（IEnumerable<String> にも List を入れる）。式は持てない
        const sg = prefixFor("clr-namespace:System.Collections.Generic;assembly=System.Private.CoreLib");
        const et = typeText(plain);
        emit(depth + 1, `<${tag}.${prop}>`);
        if (list.length === 0) emit(depth + 2, `<${sg}List x:TypeArguments="${et}" Capacity="0" />`);
        else {
          emit(depth + 2, `<${sg}List x:TypeArguments="${et}" Capacity="${Math.max(4, list.length)}">`);
          for (const x of list) {
            const text = typeof x === "object" ? (x as { lit: string }).lit : String(x);
            emit(depth + 3, `<${et}${text !== text.trim() ? ' xml:space="preserve"' : ""}>${esc(text)}</${et}>`);
          }
          emit(depth + 2, `</${sg}List>`);
        }
        emit(depth + 1, `</${tag}.${prop}>`);
        continue;
      }
      const el = listElementType(p.type)!;
      const t = objectTypes.get(el);
      const sg = prefixFor("clr-namespace:System.Collections.Generic;assembly=System.Private.CoreLib");
      // 数値・真偽値のリテラルは Int32 / Double / Boolean の InArgument、それ以外は String
      const inArg = (v: Value, at: string) => {
        const it = typeof v === "number" ? (Number.isInteger(v) ? "x:Int32" : "x:Double") : typeof v === "boolean" ? "x:Boolean" : "x:String";
        return `<InArgument x:TypeArguments="${it}">${argBody(v, it, false, scope, at)}</InArgument>`;
      };
      emit(depth + 1, `<${tag}.${prop}>`);
      emit(depth + 2, `<${sg}List x:TypeArguments="${t ? prefixFor(t.xmlns) + t.className : "InArgument"}" Capacity="${Math.max(4, list.length)}">`);
      for (const [i, x] of list.entries()) {
        const xat = sub(here, `lists.${prop}[${i}]`);
        if (!t || isValueItem(x)) { emit(depth + 3, inArg(x as Value, xat)); continue; }
        const etag = prefixFor(t.xmlns) + t.className;
        const props = Object.entries(x as Record<string, Value>).map(([k, v]) => [t.props.find((q) => q.name === k)!, v] as const);
        const attrsText = props.filter(([q]) => q.kind === "prop").map(([q, v]) => ` ${q.name}="${esc(attrValue(v, q))}"`).join("");
        const kids = props.filter(([q]) => q.kind !== "prop");
        if (!kids.length) { emit(depth + 3, `<${etag}${attrsText} />`); continue; }
        emit(depth + 3, `<${etag}${attrsText}>`);
        for (const [q, v] of kids) {
          emit(depth + 4, `<${etag}.${q.name}>`);
          emit(depth + 5, inArg(v, `${xat}.${q.name}`));
          emit(depth + 4, `</${etag}.${q.name}>`);
        }
        emit(depth + 3, `</${etag}>`);
      }
      emit(depth + 2, `</${sg}List>`);
      emit(depth + 1, `</${tag}.${prop}>`);
    }
    if (n.variables?.length) {
      emit(depth + 1, `<${tag}.Variables>`);
      n.variables.forEach((v, i) => variable(v, depth + 2, scope, sub(here, `variables[${i}]`)));
      emit(depth + 1, `</${tag}.Variables>`);
    }
    for (const { prop, value } of elems) {
      const dir = prop.kind === "out" ? "OutArgument" : "InArgument";
      const t = typeText(argumentType(n, a, scope)!);
      emit(depth + 1, `<${tag}.${prop.name}>`);
      emit(depth + 2, `<${dir} x:TypeArguments="${t}">${argBody(value, t, prop.kind === "out", scope, sub(here, `props.${prop.name}`))}</${dir}>`);
      emit(depth + 1, `</${tag}.${prop.name}>`);
    }
    for (const [k, el] of csElems) {
      emit(depth + 1, `<${tag}.${k}>`);
      emit(depth + 2, el);
      emit(depth + 1, `</${tag}.${k}>`);
    }
    const csObj = cs ? { element: (v: Value, p: Prop, path: string, typeArg?: string) => csElement(v, p, typeArg, scope, sub(here, path)), content: (v: Value, t: string, path: string) => argBody(v, t, false, scope, sub(here, path)) } : undefined;
    emitObjs(n, a, tag, depth + 1, { prefixFor, attrValue, esc, emit, typeText, cs: csObj });
    for (const [p, nodes] of slots) {
      if (p.kind === "children" && p.name === "Activities") {
        // Sequence.Activities はコンテンツプロパティなので、子をそのまま並べる
        for (const c of nodes) emitNode(c, depth + 1, new Map(scope));
      } else if (p.kind === "delegate") {
        const fi = funcInfo(p);
        if (fi) {
          const ta = [...fi.args, fi.result].map(typeText).join(", ");
          emit(depth + 1, `<${tag}.${p.name}>`);
          emit(depth + 2, `<ActivityFunc x:TypeArguments="${ta}">`);
          const inner = new Map(scope);
          fi.args.forEach((t) => {
            emit(depth + 3, `<ActivityFunc.Argument>`);
            emit(depth + 4, `<DelegateInArgument x:TypeArguments="${typeText(t)}" Name="${esc(funcArgName(t))}" />`);
            emit(depth + 3, `</ActivityFunc.Argument>`);
            inner.set(funcArgName(t), t);
          });
          emitNode(single(nodes, p.name), depth + 3, inner);
          emit(depth + 2, `</ActivityFunc>`);
          emit(depth + 1, `</${tag}.${p.name}>`);
          continue;
        }
        const types = delegateArgs(p, n.typeArg)!;
        emit(depth + 1, `<${tag}.${p.name}>`);
        activityAction(depth + 2, types, itemNames(n, types.length), nodes, scope);
        emit(depth + 1, `</${tag}.${p.name}>`);
      } else {
        emit(depth + 1, `<${tag}.${p.name}>`);
        if (p.kind === "children") for (const c of nodes) emitNode(c, depth + 2, new Map(scope));
        else emitNode(single(nodes, p.name), depth + 2, new Map(scope));
        emit(depth + 1, `</${tag}.${p.name}>`);
      }
    }
    if (n.catches?.length) {
      emit(depth + 1, `<${tag}.Catches>`);
      for (const c of n.catches) {
        emit(depth + 2, `<Catch x:TypeArguments="${typeText(c.type)}">`);
        activityAction(depth + 3, [c.type], [c.var ?? "exception"], c.body, scope);
        emit(depth + 2, `</Catch>`);
      }
      emit(depth + 1, `</${tag}.Catches>`);
    }
    if (n.assigns?.length) {
      const op = prefixFor(a.xmlns) + "AssignOperation";
      emit(depth + 1, `<${tag}.AssignOperations>`);
      emit(depth + 2, `<scg:List x:TypeArguments="${op}" Capacity="${Math.max(4, n.assigns.length)}">`);
      xmlns.set("scg", "clr-namespace:System.Collections.Generic;assembly=System.Private.CoreLib");
      for (const [i, x] of n.assigns.entries()) {
        const t = typeText(scope.get(x.to)!);
        emit(depth + 3, `<${op} sap2010:WorkflowViewState.IdRef="${idRef("AssignOperation")}">`);
        emit(depth + 4, `<${op}.To>`);
        emit(depth + 5, `<OutArgument x:TypeArguments="${t}">${argBody(x.to, t, true, scope, sub(here, `assigns[${i}].to`))}</OutArgument>`);
        emit(depth + 4, `</${op}.To>`);
        emit(depth + 4, `<${op}.Value>`);
        emit(depth + 5, `<InArgument x:TypeArguments="${t}">${argBody(x.value, t, false, scope, sub(here, `assigns[${i}].value`))}</InArgument>`);
        emit(depth + 4, `</${op}.Value>`);
        emit(depth + 3, `</${op}>`);
      }
      emit(depth + 2, `</scg:List>`);
      emit(depth + 1, `</${tag}.AssignOperations>`);
    }
    // Switch.Cases はコンテンツプロパティなので、x:Key 付きで子をそのまま並べる
    for (const [k, nodes] of Object.entries(n.cases ?? {})) emitNode(single(nodes, k), depth + 1, new Map(scope), k);
    emit(depth, `</${tag}>`);
  }

  // ActivityAction / ActivityAction<T> / ActivityAction<T1, T2> を書く
  function activityAction(depth: number, types: string[], names: string[], nodes: Node[], scope: Map<string, string>) {
    const ta = types.length ? ` x:TypeArguments="${types.map(typeText).join(", ")}"` : "";
    emit(depth, `<ActivityAction${ta}>`);
    const inner = new Map(scope);
    types.forEach((t, i) => {
      // ActivityAction<Activity>（TimeoutScope.Body）は、Studio の既定 XAML でも引数の DelegateInArgument を書かない
      if (t === "System.Activities.Activity") return;
      const prop = types.length === 1 ? "Argument" : `Argument${i + 1}`;
      emit(depth + 1, `<ActivityAction.${prop}>`);
      emit(depth + 2, `<DelegateInArgument x:TypeArguments="${typeText(t)}" Name="${esc(names[i])}" />`);
      emit(depth + 1, `</ActivityAction.${prop}>`);
      inner.set(names[i], t);
    });
    emitNode(single(nodes, "Body"), depth + 1, inner);
    emit(depth, `</ActivityAction>`);
  }

  // C# の既定値は属性に書けないので <Variable.Default> の要素にする
  function variable(v: VariableDecl, depth: number, scope: Map<string, string>, path: string) {
    const t = typeText(v.type);
    csName(v.name, path);
    if (cs && v.default !== undefined) {
      xmlns.set("mca", MCA);
      emit(depth, `<Variable x:TypeArguments="${t}" Name="${esc(v.name)}">`);
      emit(depth + 1, `<Variable.Default>`);
      emit(depth + 2, `<mca:CSharpValue x:TypeArguments="${t}">${esc(csText(v.default, scope, `${path}.default`, v.type))}</mca:CSharpValue>`);
      emit(depth + 1, `</Variable.Default>`);
      emit(depth, `</Variable>`);
      return;
    }
    const d = v.default !== undefined ? ` Default="${esc(`[${v.default}]`)}"` : "";
    emit(depth, `<Variable x:TypeArguments="${t}"${d} Name="${esc(v.name)}" />`);
  }

  // 子が1つだけ入る場所に複数書かれたら Sequence で包む（包んだ Sequence の場所は、その場所の名前）
  function single(nodes: Node[], name: string): Node {
    if (nodes.length === 1) return nodes[0];
    const seq: Node = { act: "Sequence", name, body: nodes };
    const first = paths.get(nodes[0]);
    if (first) paths.set(seq, first.replace(/\[0\]$/, ""));
    return seq;
  }
}

// 属性の値が { で始まると XAML は markup extension とみなす。リテラルの { は {} を前に付けて逃がす（JSON の文字列など）
function markupEscape(s: string): string {
  return s.startsWith("{") && !s.startsWith("{}") ? "{}" + s : s;
}

function attrValue(v: Value, p: Prop): string {
  return literalAttr(v, p) ?? `[${exprText(v)}]`;
}

// 属性にそのまま書ける値（リテラル）。式なら undefined（VB は [式]、C# は要素で書く）
function literalAttr(v: Value, p: Prop): string | undefined {
  if (typeof v === "number") return String(v);
  if (typeof v === "boolean") return v ? "True" : "False";
  if (p.kind === "prop") return markupEscape(typeof v === "string" ? v : "lit" in v ? v.lit : v.vb);
  if (typeof v === "string" && p.enum?.includes(v)) return v;
  // フラグの enum（"Keyboard, Mouse"）も属性にそのまま書く
  if (typeof v === "string" && v.includes(",") && p.enum && v.split(",").every((x) => p.enum!.includes(x.trim()))) return v;
  // String の入力に文字列リテラルを渡すときは、Studio と同じく属性にそのまま書く（[...] だと設計時に評価できない扱いになる）。
  // "[" で始まる文字列は式と区別できないので式にする
  if (typeof v === "object" && "lit" in v && p.kind === "in" && p.type === "System.String" && !v.lit.startsWith("[")) return markupEscape(v.lit);
  return undefined;
}

// C# の文字列リテラル
function csLit(s: string): string {
  return '"' + s.replace(/\\/g, "\\\\").replace(/"/g, '\\"').replace(/\r/g, "\\r").replace(/\n/g, "\\n").replace(/\t/g, "\\t") + '"';
}

// VB の式にする。{ lit } は文字列リテラル
function exprText(v: Value): string {
  if (typeof v === "object") return "lit" in v ? `"${v.lit.replace(/"/g, '""')}"` : v.vb;
  if (typeof v === "boolean") return v ? "True" : "False";
  return String(v);
}

function esc(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/\r?\n/g, "&#xA;");
}
