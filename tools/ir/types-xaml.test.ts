// IR の型名 → XAML の型表記（types-xaml.ts）のテスト
import { test } from "node:test";
import assert from "node:assert/strict";
import { toXamlType } from "./types-xaml.ts";

test("BusinessRuleException は UiPath.Core（UiPath.System.Activities）。UiPath.Core.Activities ではない", () => {
  const want = { text: "ucore:BusinessRuleException", xmlns: { ucore: "clr-namespace:UiPath.Core;assembly=UiPath.System.Activities" } };
  assert.deepEqual(toXamlType("BusinessRuleException"), want);
  assert.deepEqual(toXamlType("UiPath.Core.BusinessRuleException"), want);
});
