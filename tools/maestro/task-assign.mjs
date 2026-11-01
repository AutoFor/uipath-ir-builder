// 人のタスクの割り当て（AUT-1090）。docs/task-assignment.md
// - BPMN：SDK の humanTask に recipient が無いので、compile と format の後に足す
// - Case：SDK の action({ recipient }) は Type が何でも assignmentCriteria を "user" にする。グループのときに直す
// - 3形式とも：未割り当てのタスクを探す（verify.mjs の warning TASK_UNASSIGNED）
//
// 使い方: node tools/maestro/task-assign.mjs <ファイル.bpmn|caseplan.json> <タスク> <user|group|workload|roundRobin> <メールかグループ名>
//   <タスク> は BPMN が要素の id、Case が displayName。ファイルを上書きする。テナントには触らない。
//   BPMN の Action App は、先に bpmn-app-task.mjs で v2 にする。

import { readFileSync, writeFileSync } from "node:fs";
import { pathToFileURL } from "node:url";

// 製品の Flow → BPMN の変換（uip の maestro-tool の applyHitlExtension）の CRITERIA_MAP、RECIPIENT_TYPE_MAP と同じ
export const ASSIGNEE = {
  user: { criteria: "SingleUser", type: 2 },
  group: { criteria: "AllUsers", type: 1 },
  workload: { criteria: "Workload", type: 1 },
  roundRobin: { criteria: "RoundRobin", type: 1 },
};

function assignee(type, value) {
  const a = ASSIGNEE[type];
  if (!a) throw new Error(`割り当ての種類 ${type} を知らない（${Object.keys(ASSIGNEE).join(" / ")}）`);
  if (!value) throw new Error("割り当て先が空");
  return a;
}

const xmlAttr = (s) => String(s).replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/'/g, "&#39;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const reEsc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/** BPMN の Actions.HITL v2 のタスクに assignmentCriteria と recipient を足す。すでにあれば置き換える */
export function assignBpmn(xml, { task, type, value }) {
  const a = assignee(type, value);
  const re = new RegExp(`(<bpmn:(userTask|task)\\b[^>]*\\bid="${reEsc(task)}"[^>]*>)([\\s\\S]*?)(</bpmn:\\2>)`);
  const m = xml.match(re);
  if (!m) throw new Error(`タスク ${task} が無い`);
  if (!/<uipath:type value="Actions\.HITL" version="v2"/.test(m[3])) throw new Error(`タスク ${task} が Actions.HITL v2 ではない（Action App なら先に bpmn-app-task.mjs を流す）`);
  const body = m[3].replace(/\s*<uipath:input name="(?:assignmentCriteria|customAssignees)"[^>]*\/>/g, "").replace(/\s*<uipath:input name="recipient"[^>]*?(?:\/>|>[\s\S]*?<\/uipath:input>)/g, "");
  const json = JSON.stringify({ Value: value, Type: a.type }).replace(/]]>/g, "]]]]><![CDATA[>");
  const rows = `<uipath:input name="assignmentCriteria" type="string" value="${xmlAttr(a.criteria)}" />\n            <uipath:input name="recipient" type="json"><![CDATA[${json}]]></uipath:input>\n            `;
  const at = body.search(/<uipath:inputSchema\b|<\/uipath:context>/);
  if (at < 0) throw new Error(`タスク ${task} に uipath:context が無い`);
  return xml.replace(re, () => m[1] + body.slice(0, at) + rows + body.slice(at) + m[4]);
}

function walk(x, f) {
  if (Array.isArray(x)) x.forEach((v) => walk(v, f));
  else if (x && typeof x === "object") { f(x); Object.values(x).forEach((v) => walk(v, f)); }
}

/** caseplan.json の action タスクの割り当てを書き換える。user は SDK と同じ "user" のまま */
export function assignCase(text, { task, type, value }) {
  const a = assignee(type, value);
  const plan = JSON.parse(text);
  let hit = 0;
  walk(plan, (o) => {
    if (o.type === "action" && o.displayName === task && o.data) {
      o.data.assignmentCriteria = type === "user" ? "user" : a.criteria;
      o.data.recipient = { Type: a.type, Value: value };
      hit++;
    }
  });
  if (hit !== 1) throw new Error(`action タスク ${task} が ${hit} 件ある（1件のはず）`);
  return JSON.stringify(plan, null, 2) + "\n";
}

/** 割り当て先の無い人のタスクの名前を返す */
export function unassignedTasks(family, text) {
  const out = [];
  if (family === "bpmn") {
    for (const m of text.matchAll(/<bpmn:(userTask|task)\b[^>]*\bid="([^"]+)"[^>]*>([\s\S]*?)<\/bpmn:\1>/g)) {
      if (!m[3].includes('value="Actions.HITL"')) continue;
      const rec = m[3].match(/<uipath:input name="recipient"[^>]*>(?:<!\[CDATA\[)?([^<\]]*)/)?.[1] ?? "";
      const custom = m[3].match(/<uipath:input name="customAssignees"[^>]*\bvalue="([^"]+)"/);
      if (!/"Value"\s*:\s*"[^"]/.test(rec) && !custom) out.push(m[2]);
    }
    return out;
  }
  const doc = JSON.parse(text);
  walk(doc, (o) => {
    if (family === "flow" && typeof o.type === "string" && o.type.startsWith("uipath.human-in-the-loop") && "inputs" in o && !o.inputs?.recipient?.assignee?.value) out.push(o.id);
    if (family === "case" && o.type === "action" && o.data && !o.data.recipient?.Value) out.push(o.displayName ?? o.id);
  });
  return out;
}

if (process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url) {
  const [file, task, type, value] = process.argv.slice(2);
  if (!value) {
    console.error("使い方: node tools/maestro/task-assign.mjs <ファイル.bpmn|caseplan.json> <タスク> <user|group|workload|roundRobin> <メールかグループ名>");
    process.exit(2);
  }
  const text = readFileSync(file, "utf8");
  writeFileSync(file, (file.endsWith(".bpmn") ? assignBpmn : assignCase)(text, { task, type, value }), "utf8");
}
