import { test } from "node:test";
import assert from "node:assert/strict";
import { clearBindingFilters, stripEventFilters } from "./event-bindings.mjs";

test("コネクタのトリガーの filterExpression だけを消す", () => {
  const flow = { nodes: [
    { id: "start", type: "uipath.connector.trigger.uipath-uipath-dataservice.record-created", inputs: { detail: { eventParameters: { entityScope: "tenant" }, filterExpression: "entityScope == 'tenant'" } } },
    { id: "act", type: "uipath.connector.uipath-x.do", inputs: { detail: { filterExpression: "keep" } } },
  ] };
  assert.equal(stripEventFilters(flow), 1);
  assert.equal("filterExpression" in flow.nodes[0].inputs.detail, false);
  assert.deepEqual(flow.nodes[0].inputs.detail.eventParameters, { entityScope: "tenant" });
  assert.equal(flow.nodes[1].inputs.detail.filterExpression, "keep");
});

test("bindings の EventTrigger の FilterExpression を空にする", () => {
  const b = clearBindingFilters({ resources: [
    { resource: "EventTrigger", metadata: { FilterExpression: "entityScope == 'tenant'" } },
    { resource: "connection", metadata: {} },
  ] });
  assert.equal(b.resources[0].metadata.FilterExpression, "");
  assert.deepEqual(b.resources[1].metadata, {});
});
