// 長時間実行の図（UiPath.FlowchartBuilder.Activities の ProcessDiagram。Studio の「Long Running Workflow」）の IR を扱う部品。
//
// ProcessDiagram は Flowchart と同じく、ノードどうしが x:Reference で指し合う図。IR では Node.process に
// { start, nodes, eventSubProcesses } で書き、ノードに id を付け、矢印は行き先の id で書く（types.ts の ProcessDecl）。
//
// ノードの書き方はカタログ（catalog/UiPath.FlowchartBuilder.Activities/<版>.objects.json）のノードの型のプロパティから決める。
// 特定のノードの名前では分けない：
//   DisplayName                        → name
//   Action（子のアクティビティ）       → action（Node[]。2 つ以上なら生成器が Sequence で包む）
//   Activity<T> の子（Condition など） → condition など（式）
//   ProcessNode 型（Next・True など）   → next・true など（行き先の id）
//   Collection<ProcessNode>（Branches）→ branches（行き先の id の配列）
//   IDictionary<T, ProcessNode>（Cases）→ cases（{ 値: id }）
//   Collection<ノードの型>（BoundaryNodes）→ boundaryNodes（中に持つノードの配列。図の nodes には並べない）
//   要素で書くオブジェクト（Behavior） → behavior（"$type" で StartBehavior などを選ぶ）
//   それ以外（文字列・真偽など）       → 先頭を小文字にした名前で、値
// ノードの型は、図の StartNode の型（ProcessNode）と同じ名前空間にあり、Behavior を持つオブジェクトの型。

import type { Activity, ObjType, Prop } from "./catalog.ts";
import { objectImpls, objectTypes } from "./catalog.ts";
import type { Node, ProcessDecl, ProcessNodeDecl, Value } from "./types.ts";

export type ProcessFieldHow = "name" | "action" | "expr" | "link" | "links" | "cases" | "owned" | "obj" | "value";
export type ProcessField = { key: string; prop: Prop; how: ProcessFieldHow };

const COLLECTION = /^System\.Collections\.ObjectModel\.Collection<(.+)>$/;
const DICT = /^(?:System\.Collections\.Generic\.)?IDictionary<(.+), (.+)>$/;

// 図の StartNode の型（ProcessDiagram なら UiPath.Process.Activities.ProcessNode）。長時間実行の図でなければ undefined
export function processBase(a: Activity): string | undefined {
  const start = a.props.find((p) => p.name === "StartNode");
  const nodes = a.props.find((p) => p.name === "Nodes");
  if (!start || !nodes || start.type === "System.Activities.Statements.FlowNode") return undefined;
  return nodes.type === `System.Collections.ObjectModel.Collection<${start.type}>` ? start.type : undefined;
}

const nsOf = (t: string) => t.slice(0, t.lastIndexOf("."));

// ノードの型の一覧（clrType の名前順）
export function processNodeTypes(base: string): ObjType[] {
  const ns = nsOf(base);
  return [...objectTypes.values()].filter((t) => nsOf(t.clrType) === ns && t.props.some((p) => p.name === "Behavior")).sort((x, y) => x.clrType.localeCompare(y.clrType));
}
export function processNodeType(base: string, className: string): ObjType | undefined {
  return processNodeTypes(base).find((t) => t.className === className);
}
const isNodeType = (base: string, clr: string) => processNodeTypes(base).some((t) => t.clrType === clr);

const camel = (s: string) => s.charAt(0).toLowerCase() + s.slice(1);

// 型の名前の T を、そのノードの型引数に置き換える（SwitchNode<T> の Cases、Expression）
const generic = (t: string) => t.replace(/^(?:System\.Activities\.)?Activity<T>$/, "System.Activities.Activity<T>");

// ノードの型のプロパティを IR のキーに分ける
export function processFields(base: string, t: ObjType): ProcessField[] {
  const out: ProcessField[] = [];
  for (const p of t.props) {
    const type = generic(p.type);
    let how: ProcessFieldHow;
    if (p.name === "DisplayName") how = "name";
    else if (p.kind === "child" && type === "System.Activities.Activity") how = "action";
    else if (p.kind === "child" && /^System\.Activities\.Activity<.+>$/.test(type)) how = "expr";
    else if (type === base) how = "link";
    else if (COLLECTION.test(type) && type.match(COLLECTION)![1] === base) how = "links";
    else if (DICT.test(type) && type.match(DICT)![2] === base) how = "cases";
    else if (COLLECTION.test(type) && isNodeType(base, type.match(COLLECTION)![1])) how = "owned";
    else if (objectTypes.has(type) || objectImpls[type]) how = "obj";
    else how = "value";
    out.push({ key: how === "name" ? "name" : camel(p.name), prop: p, how });
  }
  return out;
}

// 図の（ProcessDiagram の）プロパティのうち、ノードの一覧を中に持つもの（EventSubProcesses）
export function processOwnedProps(a: Activity, base: string): { key: string; prop: Prop; type: string }[] {
  return a.props.flatMap((p) => {
    const m = p.type.match(COLLECTION);
    return p.name !== "Nodes" && m && isNodeType(base, m[1]) ? [{ key: camel(p.name), prop: p, type: m[1] }] : [];
  });
}

// ノードから出る矢印（行き先の id）。label は IR の場所（next / branches[0] / cases.<キー> など）
export function processLinks(base: string, n: ProcessNodeDecl): { label: string; to: string }[] {
  const t = processNodeType(base, n.node);
  if (!t) return [];
  const out: { label: string; to: string }[] = [];
  for (const f of processFields(base, t)) {
    const v = n[f.key];
    if (v === undefined) continue;
    if (f.how === "link" && typeof v === "string") out.push({ label: f.key, to: v });
    if (f.how === "links" && Array.isArray(v)) (v as string[]).forEach((to, i) => out.push({ label: `${f.key}[${i}]`, to }));
    if (f.how === "cases" && v && typeof v === "object") for (const [k, to] of Object.entries(v as Record<string, string>)) out.push({ label: `${f.key}.${k}`, to });
    if (f.how === "owned" && Array.isArray(v)) for (const c of v as ProcessNodeDecl[]) for (const l of processLinks(base, c)) out.push({ label: `${f.key}.${c.id}.${l.label}`, to: l.to });
  }
  return out;
}

// 図の中のノード（中に持つノードも）を、IR の場所つきで全部
export function processAllNodes(base: string, p: ProcessDecl, prefix = "process"): { path: string; node: ProcessNodeDecl }[] {
  const out: { path: string; node: ProcessNodeDecl }[] = [];
  const walk = (n: ProcessNodeDecl, path: string) => {
    out.push({ path, node: n });
    const t = processNodeType(base, n.node);
    if (!t) return;
    for (const f of processFields(base, t)) if (f.how === "owned" && Array.isArray(n[f.key])) (n[f.key] as ProcessNodeDecl[]).forEach((c, i) => walk(c, `${path}.${f.key}[${i}]`));
  };
  p.nodes?.forEach((n, i) => walk(n, `${prefix}.nodes[${i}]`));
  p.eventSubProcesses?.forEach((n, i) => walk(n, `${prefix}.eventSubProcesses[${i}]`));
  return out;
}

// 長時間実行の図は、図の種類の一覧から StartNode の型を取り出せないとき（カタログが無い）にも、ノードの action と式だけは
// たどれるようにする（graph.ts の graphChildren / graphValues）。型に頼らず、action と、式らしいキーを見る
export function processActions(p: ProcessDecl): { path: string; nodes: Node[] }[] {
  const out: { path: string; nodes: Node[] }[] = [];
  const walk = (n: ProcessNodeDecl, path: string) => {
    if (Array.isArray(n.action)) out.push({ path: `${path}.action`, nodes: n.action });
    for (const [k, v] of Object.entries(n)) if (k !== "action" && Array.isArray(v) && v.length && typeof v[0] === "object" && v[0] !== null && "node" in (v[0] as object)) (v as ProcessNodeDecl[]).forEach((c, i) => walk(c, `${path}.${k}[${i}]`));
  };
  p.nodes?.forEach((n, i) => walk(n, `process.nodes[${i}]`));
  p.eventSubProcesses?.forEach((n, i) => walk(n, `process.eventSubProcesses[${i}]`));
  return out;
}

// 図の中の式（DecisionNode.Condition、SwitchNode.Expression）。ノードの型が分かるときだけ
export function processExprs(base: string | undefined, p: ProcessDecl): { path: string; value: Value }[] {
  if (!base) return [];
  const out: { path: string; value: Value }[] = [];
  for (const { path, node } of processAllNodes(base, p)) {
    const t = processNodeType(base, node.node);
    if (!t) continue;
    for (const f of processFields(base, t)) if (f.how === "expr" && node[f.key] !== undefined) out.push({ path: `${path}.${f.key}`, value: node[f.key] as Value });
  }
  return out;
}

// 長時間実行の図の ProcessNode の型（カタログのどれかの図のアクティビティの StartNode）。graph.ts から型なしで呼ぶため
export function anyProcessBase(): string | undefined {
  for (const t of objectTypes.values()) if (t.props.some((p) => p.name === "Behavior")) return `${nsOf(t.clrType)}.ProcessNode`;
  return undefined;
}

// 図の配置（ViewState の ShapeSize）。Studio のノードの大きさ（Main.xaml の Manual Trigger は 40x40）。
// 確かめていないものは、図の上で重ならない大きさにしている
export function processShapeSize(t: ObjType): [number, number] {
  if (t.props.some((p) => p.kind === "child" && p.name === "Action") && t.props.some((p) => p.name === "BoundaryNodes")) return [180, 80]; // 作業（TaskNode）
  if (t.props.some((p) => p.kind === "child" && p.name !== "Action") || t.props.some((p) => COLLECTION.test(p.type) && p.name === "Branches") || /Merge/.test(t.className)) return [50, 50]; // 分岐・合流
  if (/SubProcess/.test(t.className)) return [180, 80];
  return [40, 40]; // イベント・終わり
}
