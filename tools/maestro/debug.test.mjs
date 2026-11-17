// tools/maestro/debug.mjs の結果のまとめ方。テナントでの実行は knowledge/maestro.md に記録した。
import { test } from "node:test";
import assert from "node:assert/strict";
import { summarize } from "./debug.mjs";

test("debug の結果から、ノードの状態と出力を並べる", () => {
  const data = {
    finalStatus: "Completed",
    elementExecutions: [{ elementId: "start", elementType: "StartEvent", status: "Completed" }, { elementId: "decide", elementType: "ScriptTask", status: "Completed" }],
    variables: { elements: [{ elementId: "decide", outputs: { response: { run: false } } }] },
  };
  assert.deepEqual(summarize(data), {
    status: "Completed",
    nodes: [
      { id: "start", type: "StartEvent", status: "Completed", output: null },
      { id: "decide", type: "ScriptTask", status: "Completed", output: { response: { run: false } } },
    ],
  });
  assert.deepEqual(summarize(undefined), { status: "unknown", nodes: [] });
});

test("bpmn debug の結果（PascalCase）も読む", () => {
  const data = { FinalStatus: "Completed", ElementExecutions: [{ ElementId: "grade", ElementType: "ScriptTask", Status: "Completed" }] };
  assert.deepEqual(summarize(data), { status: "Completed", nodes: [{ id: "grade", type: "ScriptTask", status: "Completed", output: null }] });
});

test("BPMN の変数と incident を足す（debug-instance variables / incidents の PascalCase）", async () => {
  const { addInstanceDetails } = await import("./debug.mjs");
  const s = { status: "Faulted", nodes: [{ id: "grade", type: "ScriptTask", status: "Completed", output: null }, { id: "boom", type: "ScriptTask", status: "Failed", output: null }] };
  const vars = {
    Elements: [{ ElementId: "start", Outputs: {} }, { ElementId: "grade", Outputs: { Response: { Level: "high" } } }],
    Globals: { Level: "high" },
    GlobalDefinitions: { Level: { Name: "level", Type: "string" } },
  };
  const incidents = [{ ElementId: "boom", ErrorCode: "300501", ErrorMessage: "Error invoking script task", ErrorDetails: "わざと失敗" }];
  assert.deepEqual(addInstanceDetails(s, vars, incidents), {
    status: "Faulted",
    nodes: [
      { id: "grade", type: "ScriptTask", status: "Completed", output: { Response: { Level: "high" } } },
      { id: "boom", type: "ScriptTask", status: "Failed", output: null },
    ],
    variables: { level: "high" },
    incidents: [{ element: "boom", code: "300501", message: "Error invoking script task", detail: "わざと失敗" }],
  });
  assert.deepEqual(addInstanceDetails({ status: "Completed", nodes: [] }, undefined, []), { status: "Completed", nodes: [] });
});
