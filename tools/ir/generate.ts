// 検証済みの IR から XAML を作る。XAML の書式はすべてここで決める。

import { randomUUID } from "node:crypto";
import type { Catalog, Activity, Prop } from "./catalog.ts";
import { resolve, defaultSlot, delegateArgs } from "./catalog.ts";
import type { Workflow, Node, Value, VariableDecl, InvokeArg } from "./types.ts";
import { toXamlType } from "./types-xaml.ts";
import { isUntypedArgument, argumentType, itemNames } from "./validate.ts";
import { prepareUia, emitObjs } from "./uia.ts";
import { excelPrefixes } from "./excel.ts";

const ACTIVITIES_NS = "http://schemas.microsoft.com/netfx/2009/xaml/activities";
const knownPrefixes: Record<string, string> = {
  [ACTIVITIES_NS]: "",
  "http://schemas.uipath.com/workflow/activities": "ui",
  "http://schemas.uipath.com/workflow/activities/uix": "uix",
  "clr-namespace:System.Collections.Generic;assembly=System.Private.CoreLib": "scg",
  ...excelPrefixes,
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

export function generate(wf: Workflow, cat: Catalog): string {
  const xmlns = new Map<string, string>(); // prefix -> uri
  const imports = new Set(baseImports);
  const refs = new Set(baseRefs);
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
    return r.text;
  };
  const idRef = (cls: string) => {
    const n = (ids.get(cls) ?? 0) + 1;
    ids.set(cls, n);
    return `${cls}_${n}`;
  };
  const emit = (depth: number, s: string) => lines.push("  ".repeat(depth) + s);

  // ルートは Sequence 1つにまとめる（ワークフローの変数はそこに付ける）
  const root: Node =
    wf.body.length === 1 && wf.body[0].act === "Sequence"
      ? { ...wf.body[0], variables: [...(wf.variables ?? []), ...(wf.body[0].variables ?? [])] }
      : { act: "Sequence", name: wf.workflow, variables: wf.variables, body: wf.body };

  const scope = new Map((wf.arguments ?? []).map((a) => [a.name, a.type] as [string, string]));
  emitNode(prepareUia(root, cat), 1, scope);
  const body = lines.splice(0);

  // ルート要素
  const members = (wf.arguments ?? []).map(
    (a) => `    <x:Property Name="${esc(a.name)}" Type="${a.dir}Argument(${typeText(a.type)})" />`,
  );
  const allNs: [string, string][] = [
    ["", ACTIVITIES_NS],
    ["mc", "http://schemas.openxmlformats.org/markup-compatibility/2006"],
    ["mva", "clr-namespace:Microsoft.VisualBasic.Activities;assembly=System.Activities"],
    ["sap", "http://schemas.microsoft.com/netfx/2009/xaml/activities/presentation"],
    ["sap2010", "http://schemas.microsoft.com/netfx/2010/xaml/activities/presentation"],
    ["sco", "clr-namespace:System.Collections.ObjectModel;assembly=mscorlib"],
    ...[...xmlns].filter(([p]) => !["", "mc", "mva", "sap", "sap2010", "sco", "x"].includes(p)).sort(),
    ["x", "http://schemas.microsoft.com/winfx/2006/xaml"],
  ];
  const out: string[] = [];
  out.push(`<Activity mc:Ignorable="sap sap2010" x:Class="${esc(wf.workflow)}" mva:VisualBasic.Settings="{x:Null}"`);
  for (const [p, u] of allNs) out.push(`xmlns${p ? ":" + p : ""}="${u}"${p === "x" ? ">" : ""}`);
  if (members.length) out.push("  <x:Members>", ...members, "  </x:Members>");
  out.push("  <TextExpression.NamespacesForImplementation>", '    <sco:Collection x:TypeArguments="x:String">');
  for (const i of imports) out.push(`      <x:String>${esc(i)}</x:String>`);
  out.push("    </sco:Collection>", "  </TextExpression.NamespacesForImplementation>");
  out.push("  <TextExpression.ReferencesForImplementation>", '    <sco:Collection x:TypeArguments="AssemblyReference">');
  for (const r of refs) out.push(`      <AssemblyReference>${esc(r)}</AssemblyReference>`);
  out.push("    </sco:Collection>", "  </TextExpression.ReferencesForImplementation>");
  out.push(...body, "</Activity>", "");
  return out.join("\r\n");

  function emitNode(n: Node, depth: number, scope: Map<string, string>, key?: string) {
    const r = resolve(cat, n.act, n.typeArg !== undefined);
    if ("error" in r) throw new Error(r.error);
    const a = r.activity;
    const tag = prefixFor(a.xmlns) + a.className;
    const ns = a.clrType.slice(0, a.clrType.lastIndexOf("."));
    imports.add(ns);
    refs.add(a.assembly);
    for (const v of n.variables ?? []) scope.set(v.name, v.type);

    // 属性
    const attrs: [string, string][] = [];
    if (a.genericArity > 0) attrs.push(["x:TypeArguments", typeText(n.typeArg ?? "Object")]);
    if (key !== undefined) attrs.push(["x:Key", key]);
    if (n.name) attrs.push(["DisplayName", n.name]);
    const elems: { prop: Prop; value: Value }[] = [];
    for (const [k, v] of Object.entries(n.props ?? {})) {
      const p = a.props.find((p) => p.name === k)!;
      if (isUntypedArgument(p.type)) elems.push({ prop: p, value: v });
      else if (p.type === "System.Type") attrs.push([k, `{x:Type ${typeText(String(v))}}`]);
      else attrs.push([k, attrValue(v, p)]);
    }
    // get-default-xaml に出た既定値のうち、IR が書いていないもの（Version=V5 など）
    for (const [k, v] of Object.entries(cat.defaults.get(a.className) ?? {})) {
      if (attrs.some(([x]) => x === k) || !a.props.some((p) => p.name === k)) continue;
      attrs.push([k, /^[0-9a-f]{8}-[0-9a-f]{4}-/.test(v) ? randomUUID() : v]);
    }
    const first = (k: string) => (k === "x:TypeArguments" ? 0 : k === "x:Key" ? 1 : 2);
    attrs.sort(([x], [y]) => first(x) - first(y) || x.localeCompare(y));
    attrs.push(["sap2010:WorkflowViewState.IdRef", idRef(a.className)]);
    const attrText = attrs.map(([k, v]) => ` ${k}="${esc(v)}"`).join("");

    // 子
    const slots: [Prop, Node[]][] = [];
    const slotOf = (name: string) => a.props.find((p) => p.name === name)!;
    if (n.body) slots.push([defaultSlot(a)!, n.body]);
    if (n.then) slots.push([slotOf("Then"), n.then]);
    if (n.else) slots.push([slotOf("Else"), n.else]);
    for (const [k, v] of Object.entries(n.slots ?? {})) slots.push([slotOf(k), v]);

    const hasContent =
      elems.length || slots.length || Object.keys(n.objs ?? {}).length || n.variables?.length || n.args?.length || Object.keys(n.dicts ?? {}).length || n.cases || n.catches?.length || n.assigns?.length;
    if (!hasContent) { emit(depth, `<${tag}${attrText} />`); return; }
    emit(depth, `<${tag}${attrText}>`);

    const dicts: [string, InvokeArg[]][] = [...(n.args?.length ? [["Arguments", n.args] as [string, InvokeArg[]]] : []), ...Object.entries(n.dicts ?? {})];
    for (const [prop, list] of dicts) {
      // 辞書のプロパティ。Studio の既定 XAML と同じく <scg:Dictionary> で包む（プロパティが null で始まるアクティビティもあるため）。
      // InvokeWorkflowFile（args）だけは、run で確かめた包まない形のまま
      const wrap = !(n.args?.length && prop === "Arguments");
      const p = a.props.find((x) => x.name === prop);
      const valueType = /InArgument>$/.test(p?.type ?? "") ? "InArgument" : "Argument";
      if (wrap) xmlns.set("scg", "clr-namespace:System.Collections.Generic;assembly=System.Private.CoreLib");
      emit(depth + 1, `<${tag}.${prop}>`);
      if (wrap) emit(depth + 2, `<scg:Dictionary x:TypeArguments="x:String, ${valueType}">`);
      for (const x of list) {
        const v = x.dir === "In" ? exprText(x.value) : String(x.value);
        emit(depth + (wrap ? 3 : 2), `<${x.dir}Argument x:TypeArguments="${typeText(x.type)}" x:Key="${esc(x.name)}">${esc(`[${v}]`)}</${x.dir}Argument>`);
      }
      if (wrap) emit(depth + 2, `</scg:Dictionary>`);
      emit(depth + 1, `</${tag}.${prop}>`);
    }
    if (n.variables?.length) {
      emit(depth + 1, `<${tag}.Variables>`);
      for (const v of n.variables) emit(depth + 2, variable(v));
      emit(depth + 1, `</${tag}.Variables>`);
    }
    for (const { prop, value } of elems) {
      const dir = prop.kind === "out" ? "OutArgument" : "InArgument";
      const t = typeText(argumentType(n, a, scope)!);
      const v = prop.kind === "out" ? String(value) : exprText(value);
      emit(depth + 1, `<${tag}.${prop.name}>`);
      emit(depth + 2, `<${dir} x:TypeArguments="${t}">${esc(`[${v}]`)}</${dir}>`);
      emit(depth + 1, `</${tag}.${prop.name}>`);
    }
    emitObjs(n, a, tag, depth + 1, { prefixFor, attrValue, esc, emit });
    for (const [p, nodes] of slots) {
      if (p.kind === "children" && p.name === "Activities") {
        // Sequence.Activities はコンテンツプロパティなので、子をそのまま並べる
        for (const c of nodes) emitNode(c, depth + 1, new Map(scope));
      } else if (p.kind === "delegate") {
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
      for (const x of n.assigns) {
        const t = typeText(scope.get(x.to)!);
        emit(depth + 3, `<${op} sap2010:WorkflowViewState.IdRef="${idRef("AssignOperation")}">`);
        emit(depth + 4, `<${op}.To>`);
        emit(depth + 5, `<OutArgument x:TypeArguments="${t}">${esc(`[${x.to}]`)}</OutArgument>`);
        emit(depth + 4, `</${op}.To>`);
        emit(depth + 4, `<${op}.Value>`);
        emit(depth + 5, `<InArgument x:TypeArguments="${t}">${esc(`[${exprText(x.value)}]`)}</InArgument>`);
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
      const prop = types.length === 1 ? "Argument" : `Argument${i + 1}`;
      emit(depth + 1, `<ActivityAction.${prop}>`);
      emit(depth + 2, `<DelegateInArgument x:TypeArguments="${typeText(t)}" Name="${esc(names[i])}" />`);
      emit(depth + 1, `</ActivityAction.${prop}>`);
      inner.set(names[i], t);
    });
    emitNode(single(nodes, "Body"), depth + 1, inner);
    emit(depth, `</ActivityAction>`);
  }

  function variable(v: VariableDecl) {
    const d = v.default !== undefined ? ` Default="${esc(`[${v.default}]`)}"` : "";
    return `<Variable x:TypeArguments="${typeText(v.type)}"${d} Name="${esc(v.name)}" />`;
  }
}

// 子が1つだけ入る場所に複数書かれたら Sequence で包む
function single(nodes: Node[], name: string): Node {
  return nodes.length === 1 ? nodes[0] : { act: "Sequence", name, body: nodes };
}

// 属性の値が { で始まると XAML は markup extension とみなす。リテラルの { は {} を前に付けて逃がす（JSON の文字列など）
function markupEscape(s: string): string {
  return s.startsWith("{") && !s.startsWith("{}") ? "{}" + s : s;
}

function attrValue(v: Value, p: Prop): string {
  if (typeof v === "number") return String(v);
  if (typeof v === "boolean") return v ? "True" : "False";
  if (p.kind === "prop") return markupEscape(typeof v === "string" ? v : "lit" in v ? v.lit : v.vb);
  if (typeof v === "string" && p.enum?.includes(v)) return v;
  // String の入力に文字列リテラルを渡すときは、Studio と同じく属性にそのまま書く（[...] だと設計時に評価できない扱いになる）。
  // "[" で始まる文字列は式と区別できないので式にする
  if (typeof v === "object" && "lit" in v && p.kind === "in" && p.type === "System.String" && !v.lit.startsWith("[")) return markupEscape(v.lit);
  return `[${exprText(v)}]`;
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
