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
