// 永続化（UiPath.Persistence.Activities）だけに要る検査。理由と確かめ方は knowledge/persistence.md。
// 表に載せるのは、build で落ちることを確かめたものだけ。

import type { Workflow, Node, Value } from "./types.ts";

// ジョブを中断するアクティビティ。このどれかを含むファイルは project.json のエントリポイントにする（ST-DBP-024）
export const SUSPENDING = new Set(["WaitForFormTaskAndResume", "WaitForExternalTaskAndResume", "WaitForJobAndResume", "WaitForQueueItemAndResume", "WaitForUserActionAndResume", "ResumeAfterDelay"]);

// 永続化できないスコープの制約を持つもの。ResumeAfterDelay は NoPersistScope の中でも build が通るので入れない
const SCOPE_CHECKED = new Set([...SUSPENDING].filter((a) => a !== "ResumeAfterDelay"));

// build が "Cannot place activity under scope" で落とすスコープ
const NO_PERSIST_SCOPES = new Set(["NoPersistScope", "NApplicationCard", "OpenBrowser", "WindowScope"]);

const shortName = (act: string) => act.slice(act.lastIndexOf(".") + 1);

function children(n: Node): [string, Node[]][] {
  const out: [string, Node[]][] = [];
  if (n.body) out.push(["body", n.body]);
  if (n.then) out.push(["then", n.then]);
  if (n.else) out.push(["else", n.else]);
  for (const [k, v] of Object.entries(n.slots ?? {})) out.push([`slots.${k}`, v]);
  for (const [k, v] of Object.entries(n.cases ?? {})) out.push([`cases.${k}`, v]);
  (n.catches ?? []).forEach((c, i) => out.push([`catches[${i}].body`, c.body]));
  return out;
}

// CreateFormTask の FormLayout（AUT-1076）。リテラルは JSON の配列にする。式（変数、VB の式）は実行時まで分からないので見ない。
// 返り値：undefined = 式（検査しない）、それ以外 = リテラルの文字列
export function formLayoutLiteral(v: Value | undefined): string | undefined {
  return v !== undefined && typeof v === "object" && "lit" in v ? v.lit : undefined;
}

export function checkFormLayout(n: Node, path: string, add: (path: string, code: string, message: string) => void) {
  const v = n.props?.FormLayout;
  if (v === undefined) {
    add(`${path}.props`, "FORM_LAYOUT_MISSING", "CreateFormTask に FormLayout が無い（実行時に「フォーム レイアウト無効」で落ちる。GenerateInputFields だけでは動かない。JSON の配列を書く）");
    return;
  }
  const lit = formLayoutLiteral(v);
  if (lit === undefined) return;
  const at = `${path}.props.FormLayout`;
  let parsed: unknown;
  try { parsed = JSON.parse(lit); } catch (e) {
    add(at, "FORM_LAYOUT_BAD_JSON", `FormLayout のリテラルが JSON として読めない（${(e as Error).message}）。JSON の配列を書く`);
    return;
  }
  if (!Array.isArray(parsed))
    add(at, "FORM_LAYOUT_NOT_ARRAY", "FormLayout のリテラルは JSON の配列にする（{\"components\":[...]} のようなオブジェクトだと Action Center の画面が空になる。knowledge/persistence.md）");
  else if (hasEventButton(parsed))
    add(at, "FORM_LAYOUT_BUTTON_EVENT", "ボタンに action:\"event\" がある（form.io はイベントを出すだけで送信しないので、画面で押してもタスクが完了しない疑いが強い。action と event を外し、{type,key,label,theme,input,tableView} にする。knowledge/persistence.md）");
}

// 入れ子の components、columns の中も含め、action:"event" のボタンを探す
function hasEventButton(x: unknown): boolean {
  if (Array.isArray(x)) return x.some(hasEventButton);
  if (x === null || typeof x !== "object") return false;
  const o = x as Record<string, unknown>;
  if (o.type === "button" && o.action === "event") return true;
  return Object.values(o).some(hasEventButton);
}

// Criteria.Id の値（AUT-1090）。DLL のユーザー文字列と、API クライアントの enum の文字列にあるのはこの4つだけ。build は値を見ないので、ここで止める
const CRITERIA_IDS = new Set(["SingleUser", "AllUsers", "RoundRobin", "Workload"]);

function checkCriteria(n: Node, path: string, add: (path: string, code: string, message: string) => void) {
  for (const prop of ["AssignmentCriteria", "ReassignCriteria"]) {
    const id = (n.objs?.[prop] as { Id?: Value } | undefined)?.Id;
    const lit = formLayoutLiteral(id);
    if (lit !== undefined && !CRITERIA_IDS.has(lit))
      add(`${path}.objs.${prop}.Id`, "ASSIGNMENT_CRITERIA_ID", `割り当て条件の Id "${lit}" は無い（${[...CRITERIA_IDS].join(" / ")}。knowledge/persistence.md）`);
  }
}

// CreateFormTask の AllUsers に UserNameOrEmail だけを書く形（AUT-1104 の実測：ジョブは成功するが、ユーザーは無視されてタスクは Unassigned のまま。docs/task-assignment.md）
function checkAllUsersUser(n: Node, path: string, add: (path: string, code: string, message: string) => void) {
  const id = formLayoutLiteral((n.objs?.AssignmentCriteria as { Id?: Value } | undefined)?.Id);
  if (id === "AllUsers" && n.props?.UserNameOrEmail !== undefined && n.props?.Group === undefined)
    add(`${path}.props.UserNameOrEmail`, "ASSIGN_ALL_USERS_WITHOUT_GROUP", "AllUsers に UserNameOrEmail だけを書くと、ユーザーは無視されてタスクは Unassigned のままになる（実測）。人に割り当てるなら条件を SingleUser にする（knowledge/persistence.md）");
}

export function checkPersistence(wf: Workflow, add: (path: string, code: string, message: string) => void) {
  const walk = (nodes: Node[], base: string, scope: string | undefined) =>
    nodes.forEach((n, i) => {
      const path = `${base}[${i}]`;
      const name = shortName(n.act);
      if (name === "CreateFormTask") checkFormLayout(n, path, add);
      checkCriteria(n, path, add);
      if (name === "CreateFormTask") checkAllUsersUser(n, path, add);
      if (scope && SCOPE_CHECKED.has(name))
        add(path, "PERSIST_IN_NO_PERSIST_SCOPE", `${name} は ${scope} の中に置けない（永続化できないスコープ。外に出す）`);
      const inner = NO_PERSIST_SCOPES.has(name) ? name : scope;
      for (const [k, c] of children(n)) walk(c, `${path}.${k}`, inner);
    });
  walk(wf.body, "body", undefined);
}

// このワークフローに中断するアクティビティがあるか（エントリポイントの確認用）
export function hasSuspending(wf: Workflow): boolean {
  const any = (nodes: Node[]): boolean => nodes.some((n) => SUSPENDING.has(shortName(n.act)) || children(n).some(([, c]) => any(c)));
  return any(wf.body);
}
