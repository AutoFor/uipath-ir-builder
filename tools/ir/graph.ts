// 図（Flowchart・StateMachine・Pick）の IR を扱う共通の部品。
//
// IR はアクティビティを入れ子の木で持つが、Flowchart と StateMachine はノードどうしが指し合う図なので、
// ノードに id を付け、矢印を行き先の id で書く（types.ts の FlowchartDecl / StateMachineDecl / BranchDecl）。
// 子をたどる道具（検証、Coded、UI のスコープなど）は graphChildren / graphValues で図の中の子と式を受け取る。

import type { Node, Value, VariableDecl, FlowNode, FlowStepDecl, FlowDecisionDecl, FlowSwitchDecl, StateDecl } from "./types.ts";

export type FlowKind = "step" | "decision" | "switch";

// ノードの種類。act があれば FlowStep、decision なら FlowDecision、switch なら FlowSwitch。どれでもない・2つ以上なら undefined
export function flowKind(f: FlowNode): FlowKind | undefined {
  const o = f as Record<string, unknown>;
  const has = (["act", "decision", "switch"] as const).filter((k) => o[k] !== undefined);
  if (has.length !== 1) return undefined;
  return has[0] === "act" ? "step" : has[0];
}

// ノードから出る矢印（行き先の id）。label は図の上の名前（next / true / false / cases.<キー> / default）
export function flowLinks(f: FlowNode): { label: string; to: string }[] {
  const out: { label: string; to: string }[] = [];
  const k = flowKind(f);
  if (k === "step") { const s = f as FlowStepDecl; if (s.next !== undefined) out.push({ label: "next", to: s.next }); }
  if (k === "decision") {
    const d = f as FlowDecisionDecl;
    if (d.true !== undefined) out.push({ label: "true", to: d.true });
    if (d.false !== undefined) out.push({ label: "false", to: d.false });
  }
  if (k === "switch") {
    const s = f as FlowSwitchDecl;
    for (const [key, to] of Object.entries(s.cases ?? {})) out.push({ label: `cases.${key}`, to });
    if (s.default !== undefined) out.push({ label: "default", to: s.default });
  }
  return out;
}

// FlowStep の、図の情報（id / next）を除いたアクティビティのノード
export function stepNode(s: FlowStepDecl): Node {
  const { id: _id, next: _next, ...n } = s;
  return n;
}

// 図の中の子のノードの並び。path はノードからの IR の場所（並びの名前）、paths[j] は nodes[j] の場所、
// vars はその並びから見える、図で増える変数（State.Variables、PickBranch.Variables）。
// FlowStep は1つずつの並びで、場所は flowchart.nodes[i]（[0] は付かない）
export type GraphPart = { path: string; nodes: Node[]; paths: string[]; vars?: VariableDecl[] };

export function graphChildren(n: Node): GraphPart[] {
  const out: GraphPart[] = [];
  const list = (path: string, nodes: Node[], vars?: VariableDecl[]) => out.push({ path, nodes, paths: nodes.map((_, j) => `${path}[${j}]`), ...(vars ? { vars } : {}) });
  n.flowchart?.nodes.forEach((f, i) => { if (flowKind(f) === "step") out.push({ path: `flowchart.nodes[${i}]`, nodes: [f as FlowStepDecl], paths: [`flowchart.nodes[${i}]`] }); });
  n.stateMachine?.states.forEach((s, i) => {
    const at = `stateMachine.states[${i}]`;
    const vars = s.variables;
    if (s.entry) list(`${at}.entry`, s.entry, vars);
    if (s.exit) list(`${at}.exit`, s.exit, vars);
    s.transitions?.forEach((t, j) => {
      if (t.trigger) list(`${at}.transitions[${j}].trigger`, t.trigger, vars);
      if (t.action) list(`${at}.transitions[${j}].action`, t.action, vars);
    });
  });
  n.branches?.forEach((b, i) => {
    if (b.trigger) list(`branches[${i}].trigger`, b.trigger, b.variables);
    if (b.action) list(`branches[${i}].action`, b.action, b.variables);
  });
  return out;
}

// 図の中の子のノードを、場所つきで全部（子の子はたどらない）
export function graphNodes(n: Node): { path: string; node: Node }[] {
  return graphChildren(n).flatMap((g) => g.nodes.map((node, j) => ({ path: g.paths[j], node })));
}

// 図の中の式（FlowDecision の条件、FlowSwitch の式、Transition の条件）と、その位置で見える図の変数
export function graphValues(n: Node): { path: string; value: Value; vars?: VariableDecl[] }[] {
  const out: { path: string; value: Value; vars?: VariableDecl[] }[] = [];
  n.flowchart?.nodes.forEach((f, i) => {
    const k = flowKind(f);
    if (k === "decision") out.push({ path: `flowchart.nodes[${i}].decision`, value: (f as FlowDecisionDecl).decision });
    if (k === "switch") out.push({ path: `flowchart.nodes[${i}].switch`, value: (f as FlowSwitchDecl).switch });
  });
  n.stateMachine?.states.forEach((s, i) => s.transitions?.forEach((t, j) => {
    if (t.condition !== undefined) out.push({ path: `stateMachine.states[${i}].transitions[${j}].condition`, value: t.condition, vars: s.variables });
  }));
  return out;
}

// 図の変数の宣言（State.Variables、PickBranch.Variables）と、その IR の場所
export function graphVariables(n: Node): { path: string; vars: VariableDecl[] }[] {
  const out: { path: string; vars: VariableDecl[] }[] = [];
  n.stateMachine?.states.forEach((s, i) => { if (s.variables) out.push({ path: `stateMachine.states[${i}].variables`, vars: s.variables }); });
  n.branches?.forEach((b, i) => { if (b.variables) out.push({ path: `branches[${i}].variables`, vars: b.variables }); });
  return out;
}

// 図を持つか
export const hasGraph = (n: Node) => !!(n.flowchart || n.stateMachine || n.branches);

// 図の中の子のノードを f で写した、新しい図（out に入れる）。FlowStep は id / next を残す
export function mapGraph(n: Node, f: (list: Node[]) => Node[]): Pick<Node, "flowchart" | "stateMachine" | "branches"> {
  const out: Pick<Node, "flowchart" | "stateMachine" | "branches"> = {};
  if (n.flowchart) out.flowchart = { ...n.flowchart, nodes: n.flowchart.nodes.map((x) => flowKind(x) === "step" ? { ...f([x as FlowStepDecl])[0], id: x.id, ...((x as FlowStepDecl).next !== undefined ? { next: (x as FlowStepDecl).next } : {}) } : x) };
  if (n.stateMachine) out.stateMachine = { ...n.stateMachine, states: n.stateMachine.states.map((s): StateDecl => ({
    ...s,
    ...(s.entry ? { entry: f(s.entry) } : {}),
    ...(s.exit ? { exit: f(s.exit) } : {}),
    ...(s.transitions ? { transitions: s.transitions.map((t) => ({ ...t, ...(t.trigger ? { trigger: f(t.trigger) } : {}), ...(t.action ? { action: f(t.action) } : {}) })) } : {}),
  })) };
  if (n.branches) out.branches = n.branches.map((b) => ({ ...b, trigger: f(b.trigger), ...(b.action ? { action: f(b.action) } : {}) }));
  return out;
}

// x:Name に書ける id（文字か _ で始まり、文字・数字・_ が続く）
export const isGraphId = (s: unknown): s is string => typeof s === "string" && /^[\p{L}_][\p{L}\p{N}_]*$/u.test(s);

// ---- 図の配置（ViewState）----
// Studio で開いたときに図として並ぶよう、IR だけから決まる位置を出す。矢印の経路（ConnectorLocation）は出さず、Studio に引かせる。
// start から幅優先でたどった深さを行、行の中の順を列にする。たどり着けないノード（検証で弾く）は最後の行に置く

export type Layout = Map<string, { level: number; col: number }>;

export function layoutGraph(ids: string[], start: string, links: (id: string) => string[]): Layout {
  const out: Layout = new Map();
  const count: number[] = [];
  const place = (id: string, level: number) => { const col = count[level] ?? 0; count[level] = col + 1; out.set(id, { level, col }); };
  const known = new Set(ids);
  if (known.has(start)) place(start, 0);
  const queue = known.has(start) ? [start] : [];
  while (queue.length) {
    const id = queue.shift()!;
    const level = out.get(id)!.level;
    for (const to of links(id)) if (known.has(to) && !out.has(to)) { place(to, level + 1); queue.push(to); }
  }
  const last = count.length;
  for (const id of ids) if (!out.has(id)) place(id, last);
  return out;
}
