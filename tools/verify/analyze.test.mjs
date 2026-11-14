import { test } from "node:test";
import assert from "node:assert/strict";
import { summarize } from "./analyze.mjs";

test("summarize：ErrorCode が ERROR はエラー、ほかは規則の指摘", () => {
  const { errors, rules } = summarize([
    { ErrorCode: "ERROR", Description: "BC30451: 'nameX' is not declared.", FilePath: "C:\\p\\Main.xaml", ActivityDisplayName: "Log Message" },
    { ErrorCode: "ST-USG-020", Description: "Log Message not used in workflow Greet.", FilePath: null, WorkflowDisplayName: "Greet" },
  ]);
  assert.deepEqual(errors, [{ code: "ERROR", file: "Main.xaml", activity: "Log Message", message: "BC30451: 'nameX' is not declared." }]);
  assert.equal(rules.length, 1);
  assert.equal(rules[0].file, "Greet");
  assert.deepEqual(summarize(undefined), { errors: [], rules: [] });
});
