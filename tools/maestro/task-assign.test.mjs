import { test } from "node:test";
import assert from "node:assert/strict";
import { assignBpmn, assignCase, unassignedTasks } from "./task-assign.mjs";

const xml = (ver = "v2", extra = "") => `<bpmn:process id="P">
<bpmn:userTask id="review"><bpmn:extensionElements><uipath:activity version="v1">
<uipath:type value="Actions.HITL" version="${ver}" />
<uipath:context>
<uipath:input name="taskTitle" type="string" value="t" />${extra}
<uipath:inputSchema type="jsonSchema">{}</uipath:inputSchema>
</uipath:context></uipath:activity></bpmn:extensionElements></bpmn:userTask>
<bpmn:userTask id="other"><uipath:type value="Actions.HITL" version="v2" /><uipath:context></uipath:context></bpmn:userTask>
</bpmn:process>`;

test("BPMN：ユーザーとグループを context の中に足す", () => {
  const u = assignBpmn(xml(), { task: "review", type: "user", value: "user@example.com" });
  assert.match(u, /name="assignmentCriteria" type="string" value="SingleUser"/);
  assert.match(u, /name="recipient" type="json"><!\[CDATA\[\{"Value":"user@example.com","Type":2\}\]\]>/);
  assert.ok(u.indexOf('name="recipient"') < u.indexOf("<uipath:inputSchema"));
  const g = assignBpmn(xml(), { task: "review", type: "roundRobin", value: "Reviewers" });
  assert.match(g, /value="RoundRobin"/);
  assert.match(g, /"Value":"Reviewers","Type":1/);
});

test("BPMN：2回流しても1組だけ。ほかのタスクは変えない", () => {
  const a = assignBpmn(xml(), { task: "review", type: "user", value: "a@example.com" });
  const b = assignBpmn(a, { task: "review", type: "group", value: "G" });
  assert.equal(b.match(/name="recipient"/g).length, 1);
  assert.equal(b.match(/name="assignmentCriteria"/g).length, 1);
  assert.deepEqual(unassignedTasks("bpmn", b), ["other"]);
});

test("BPMN：v2 でないもの、無いタスク、知らない種類、空は投げる", () => {
  assert.throws(() => assignBpmn(xml("v1"), { task: "review", type: "user", value: "x" }), /bpmn-app-task/);
  assert.throws(() => assignBpmn(xml(), { task: "none", type: "user", value: "x" }), /が無い/);
  assert.throws(() => assignBpmn(xml(), { task: "review", type: "nobody", value: "x" }), /知らない/);
  assert.throws(() => assignBpmn(xml(), { task: "review", type: "user", value: "" }), /空/);
});

test("Case：グループは assignmentCriteria を直す。user は SDK のまま", () => {
  const plan = JSON.stringify({ stages: [{ data: { tasks: [[{ type: "action", displayName: "Approve", data: { assignmentCriteria: "user", recipient: { Type: 1, Value: "G" } } }]] } }] });
  const g = JSON.parse(assignCase(plan, { task: "Approve", type: "group", value: "G" })).stages[0].data.tasks[0][0].data;
  assert.equal(g.assignmentCriteria, "AllUsers");
  assert.deepEqual(g.recipient, { Type: 1, Value: "G" });
  const u = JSON.parse(assignCase(plan, { task: "Approve", type: "user", value: "a@example.com" })).stages[0].data.tasks[0][0].data;
  assert.equal(u.assignmentCriteria, "user");
  assert.deepEqual(u.recipient, { Type: 2, Value: "a@example.com" });
  assert.throws(() => assignCase(plan, { task: "None", type: "user", value: "x" }), /0 件/);
});

test("未割り当ての検出：Flow、Case", () => {
  const flow = (assignee) => JSON.stringify({ nodes: [{ id: "s", type: "core.script", inputs: {} }, { id: "h", type: "uipath.human-in-the-loop.quick-form", inputs: { recipient: { channels: [], assignee } } }], definitions: [{ nodeType: "uipath.human-in-the-loop.quick-form" }] });
  assert.deepEqual(unassignedTasks("flow", flow({ type: "group" })), ["h"]);
  assert.deepEqual(unassignedTasks("flow", flow({ type: "user", value: "a@example.com" })), []);
  const task = (data) => JSON.stringify({ t: [{ type: "action", displayName: "A", id: "x", data }, { type: "rpa", displayName: "B", data: {} }] });
  assert.deepEqual(unassignedTasks("case", task({})), ["A"]);
  assert.deepEqual(unassignedTasks("case", task({ recipient: { Type: 2, Value: "a@example.com" } })), []);
});
