// Maestro Case に QuickForm（アプリなしのフォーム）の人のタスクを足す（AUT-1211）。
// SDK 6.66.5 の Case には QuickForm を書く手段が無い。compile した caseplan.json に、Studio Web が書く形
// （type "action"、context の hitlType "quick"、横の <タスク>.hitl.json）でタスクを足す。形は公式の skill
// （uipath-human-in-the-loop の hitl-casetask-action.md の Path 1）と、SDK が action のタスクに書く outputs に合わせた。
//
// 使い方:
//   node tools/maestro/case-quickform.mjs <caseplan.json> <spec.json>
// spec（見本は samples/maestro/coverage/CaseQuickForm.quickform.json）:
//   { "stage": "<ステージの名前>", "tasks": [ { "name", "title", "taskTitle"?, "priority"?, "recipient"?,
//     "fields": [ { "id", "label", "type", "direction": "input"|"output"|"inOut", "binding"?, "variable"?, "required"? } ],
//     "outcomes": ["Approve", "Reject"], "outcomeVar"?: "<押したボタンを入れる変数>", "isRequired"?: true } ] }
//   recipient は { "email": "…" } か { "group": "…" }（無ければ割り当てない）
// verify.mjs は、ソースの横に <名前>.quickform.json があれば compile の後でこれを当てる。
//
// 注意：_schemaFileId は Studio Web がファイルに付ける ID で、ここでは仮の UUID を書く。実行には効かないが、
// Studio Web の「Edit Schema」は開けない（skill の文書）。終了コード: 0 = 足した、1 = spec の間違い、2 = 使い方の間違い

import { randomUUID, randomBytes } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";

const TYPES = new Set(["string", "number", "boolean", "date", "datetime"]);
const short = () => randomBytes(6).toString("base64").replace(/[^A-Za-z0-9]/g, "").slice(0, 8).padEnd(8, "x");

/** spec の間違いを並べる（空なら正しい） */
export function checkSpec(plan, spec) {
  const errs = [];
  const stage = (plan.nodes ?? []).find((n) => /stage/i.test(n.type ?? "") && n.data?.label === spec?.stage);
  if (!stage) errs.push(`ステージ "${spec?.stage}" が caseplan に無い`);
  const vars = new Set([...(plan.variables?.inputOutputs ?? []), ...(plan.variables?.inputs ?? []), ...(plan.variables?.outputs ?? [])].map((v) => v.id));
  for (const t of spec?.tasks ?? []) {
    if (!t.name || !t.title) errs.push(`タスクに name と title が要る：${JSON.stringify(t).slice(0, 80)}`);
    if (!(t.outcomes?.length > 0)) errs.push(`${t.name}: outcomes（ボタン）が 1 つ以上要る`);
    for (const f of t.fields ?? []) {
      if (!f.id || !f.label || !TYPES.has(f.type)) errs.push(`${t.name}.${f.id}: id・label と type（${[...TYPES].join(" / ")}）が要る`);
      if (!["input", "output", "inOut"].includes(f.direction)) errs.push(`${t.name}.${f.id}: direction は input / output / inOut`);
      if (f.direction !== "output" && !f.binding) errs.push(`${t.name}.${f.id}: ${f.direction} には binding（=vars.<名前> など）が要る`);
      if (f.direction !== "input") {
        const v = String(f.variable ?? "").replace(/^vars\./, "");
        if (!f.variable) errs.push(`${t.name}.${f.id}: ${f.direction} には variable（vars.<名前>）が要る`);
        else if (!vars.has(v)) errs.push(`${t.name}.${f.id}: 変数 ${v} が caseplan に無い（ソースで .var() する）`);
      }
    }
    if (t.outcomeVar && !vars.has(t.outcomeVar)) errs.push(`${t.name}: outcomeVar の変数 ${t.outcomeVar} が caseplan に無い（ソースで .var() する）`);
  }
  return errs;
}

/** caseplan にタスクを足し、書き出す .hitl.json を返す（ids は試験で固定するため差し替えられる） */
export function addQuickForms(plan, spec, ids = { task: () => `t${short()}`, cond: () => `Condition_${short()}`, rule: () => `Rule_${short()}`, uuid: randomUUID }) {
  const stage = plan.nodes.find((n) => /stage/i.test(n.type ?? "") && n.data?.label === spec.stage);
  stage.data.tasks ??= [];
  const files = [];
  for (const t of spec.tasks) {
    const id = ids.task();
    const elementId = `${stage.id}-${id}`;
    const schemaId = ids.uuid();
    const taskTitle = t.taskTitle ?? t.title;
    const outs = t.fields.filter((f) => f.direction !== "input");
    const hitl = {
      title: t.title,
      fields: t.fields.map((f) => ({ id: f.id, label: f.label, type: f.type, direction: f.direction,
        ...(f.binding ? { binding: f.binding } : {}), ...(f.variable ? { variable: f.variable } : {}), ...(f.required ? { required: true } : {}) })),
      outcomes: t.outcomes.map((name, i) => ({ id: `outcome-${i}`, name, type: "string", isPrimary: i === 0 })),
      schemaId,
    };
    const recipient = t.recipient?.email ? { Type: 2, Value: t.recipient.email } : t.recipient?.group ? { Type: 1, Value: t.recipient.group } : null;
    const output = (name, type, varName, extra = {}) => ({ name, type, value: name, id: varName, var: varName, source: `=${name}`, target: `=${name}`, elementId, ...extra });
    stage.data.tasks.push([{
      id,
      displayName: t.name,
      type: "action",
      elementId,
      isRequired: t.isRequired ?? true,
      shouldRunOnlyOnce: false,
      entryConditions: [{ id: ids.cond(), displayName: `${t.name} entry`, rules: [[{ rule: "current-stage-entered", id: ids.rule() }]] }],
      data: {
        taskTitle,
        context: [
          { name: "hitlType", type: "string", value: "quick" },
          { name: "taskTitle", type: "string", value: taskTitle },
          { name: "labels", type: "string" },
          { name: "priority", type: "string", value: t.priority ?? "Medium" },
          { name: "actionCatalogName", type: "string" },
          { name: "enableActionableNotifications", type: "boolean", value: "false" },
          ...(recipient ? [{ name: "assignmentCriteria", type: "string", ...(recipient.Type === 2 ? { value: "user" } : {}) }, { name: "recipient", type: "json", body: recipient }] : []),
          { name: "_schemaFileId", type: "string", value: ids.uuid() },
          { name: "hitlSchemaId", type: "string", value: schemaId },
        ],
        inputs: t.fields.filter((f) => f.direction !== "output").map((f) => ({ name: f.id, type: f.type, displayName: f.label, target: "bodyField", value: f.binding })),
        outputs: [
          ...outs.map((f) => output(f.id, f.type, String(f.variable).replace(/^vars\./, ""), { displayName: f.label })),
          ...(t.outcomeVar ? [output("Action", "string", t.outcomeVar, { displayName: "Action", options: t.outcomes.map((o) => ({ value: o, label: o })) })] : []),
        ],
        inputSchema: {
          $schema: "http://json-schema.org/draft-07/schema#",
          type: "object",
          properties: Object.fromEntries(t.fields.filter((f) => f.direction !== "output").map((f) => [f.id, { type: f.type, title: f.label }])),
          required: [],
        },
      },
    }]);
    files.push({ name: `${t.name}.hitl.json`, content: hitl });
  }
  return { plan, files };
}

function main() {
  const [planPath, specPath] = process.argv.slice(2);
  if (!planPath || !specPath) { console.error("使い方: node tools/maestro/case-quickform.mjs <caseplan.json> <spec.json>"); process.exit(2); }
  const plan = JSON.parse(readFileSync(planPath, "utf8"));
  const spec = JSON.parse(readFileSync(specPath, "utf8"));
  const errs = checkSpec(plan, spec);
  if (errs.length) { for (const e of errs) console.error(`error: ${e}`); process.exit(1); }
  const { files } = addQuickForms(plan, spec);
  writeFileSync(planPath, JSON.stringify(plan, null, 2) + "\n");
  for (const f of files) writeFileSync(join(dirname(resolve(planPath)), f.name), JSON.stringify(f.content, null, 2) + "\n");
  console.log(`QuickForm を ${files.length} 個足した：${files.map((f) => f.name).join("、")}`);
}

if (process.argv[1] && resolve(process.argv[1]).endsWith("case-quickform.mjs")) main();
