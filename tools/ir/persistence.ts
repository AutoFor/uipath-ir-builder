// 永続化（UiPath.Persistence.Activities）だけに要る検査。理由と確かめ方は knowledge/persistence.md。
// 表に載せるのは、build で落ちることを確かめたものだけ。

import type { Workflow, Node } from "./types.ts";

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

export function checkPersistence(wf: Workflow, add: (path: string, code: string, message: string) => void) {
  const walk = (nodes: Node[], base: string, scope: string | undefined) =>
    nodes.forEach((n, i) => {
      const path = `${base}[${i}]`;
      const name = shortName(n.act);
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
