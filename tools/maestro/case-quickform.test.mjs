// tools/maestro/case-quickform.mjs：Case に QuickForm のタスクを足す。テナントでの実行は knowledge/maestro.md の 7 章。
import { test } from "node:test";
import assert from "node:assert/strict";
import { addQuickForms, checkSpec } from "./case-quickform.mjs";

const plan = () => ({
  variables: { inputOutputs: [{ id: "decision" }, { id: "comment" }], inputs: [{ id: "vX", name: "amount" }] },
  nodes: [{ id: "Stage_A", type: "case-management:Stage", data: { label: "Review", tasks: [] } }],
});
const spec = {
  stage: "Review",
  tasks: [{
    name: "Approve", title: "経費の確認",
    fields: [
      { id: "amount", label: "金額", type: "number", direction: "input", binding: "=vars.amount" },
      { id: "comment", label: "コメント", type: "string", direction: "output", variable: "vars.comment" },
    ],
    outcomes: ["Approve", "Reject"], outcomeVar: "decision",
  }],
};
let n = 0;
const ids = { task: () => "tTASK", cond: () => "Condition_1", rule: () => "Rule_1", uuid: () => `00000000-0000-4000-8000-00000000000${n++}` };

test("タスクと .hitl.json を Studio Web の形で足す", () => {
  n = 0;
  const { plan: p, files } = addQuickForms(plan(), spec, ids);
  const t = p.nodes[0].data.tasks[0][0];
  assert.equal(t.type, "action");
  assert.equal(t.elementId, "Stage_A-tTASK");
  assert.deepEqual(t.data.context.find((c) => c.name === "hitlType"), { name: "hitlType", type: "string", value: "quick" });
  const schemaId = t.data.context.find((c) => c.name === "hitlSchemaId").value;
  assert.equal(files[0].name, "Approve.hitl.json");
  assert.equal(files[0].content.schemaId, schemaId);
  assert.deepEqual(files[0].content.outcomes.map((o) => [o.name, o.isPrimary]), [["Approve", true], ["Reject", false]]);
  assert.deepEqual(t.data.inputs, [{ name: "amount", type: "number", displayName: "金額", target: "bodyField", value: "=vars.amount" }]);
  assert.deepEqual(t.data.outputs.map((o) => [o.name, o.var, o.source, o.id]), [["comment", "comment", "=comment", "comment"], ["Action", "decision", "=Action", "decision"]]);
  assert.deepEqual(Object.keys(t.data.inputSchema.properties), ["amount"]);
});

test("spec の間違いを止める", () => {
  assert.deepEqual(checkSpec(plan(), spec), []);
  const bad = { stage: "Nope", tasks: [{ name: "X", title: "x", outcomes: [], outcomeVar: "missing", fields: [{ id: "a", label: "A", type: "text", direction: "output", variable: "vars.zz" }] }] };
  const errs = checkSpec(plan(), bad).join("\n");
  assert.match(errs, /ステージ "Nope"/);
  assert.match(errs, /outcomes/);
  assert.match(errs, /type/);
  assert.match(errs, /変数 zz/);
  assert.match(errs, /outcomeVar の変数 missing/);
});
