// IR の型名 → XAML の型表記（types-xaml.ts）のテスト
import { test } from "node:test";
import assert from "node:assert/strict";
import { toXamlType } from "./types-xaml.ts";

test("BusinessRuleException は UiPath.Core（UiPath.System.Activities）。UiPath.Core.Activities ではない", () => {
  const want = { text: "ucore:BusinessRuleException", xmlns: { ucore: "clr-namespace:UiPath.Core;assembly=UiPath.System.Activities" } };
  assert.deepEqual(toXamlType("BusinessRuleException"), want);
  assert.deepEqual(toXamlType("UiPath.Core.BusinessRuleException"), want);
});

test("Data Fabric の表の型は entitiesStores の名前空間で読み書きする。Tuple もジェネリックに使える", async () => {
  const { registerEntityNamespaces } = await import("./types-xaml.ts");
  registerEntityNamespaces(["MoneyForwardCrossPlatform"]);
  assert.deepEqual(toXamlType("MoneyForwardCrossPlatform.MfFamilyIncomeExpense"), { text: "de:MfFamilyIncomeExpense", xmlns: { de: "clr-namespace:MoneyForwardCrossPlatform;assembly=DataService.MoneyForwardCrossPlatform" } });
  assert.deepEqual(toXamlType("DataService.Entities.WorkCalendar"), { text: "de:WorkCalendar", xmlns: { de: "clr-namespace:DataService.Entities;assembly=DataService.DataService.Entities" } });
  const t = toXamlType("IList<Tuple<String, MoneyForwardCrossPlatform.MfFamilyIncomeExpense>>");
  assert.ok(!("error" in t) && t.text === "scg:IList(s:Tuple(x:String, de:MfFamilyIncomeExpense))");
});

test("取り込み：型付きの表（Studio.Generated.TypedDataTable）は DataTable、表の型は名前空間つきの名前", async () => {
  const { irType } = await import("./import-xaml.ts");
  const { registerEntityNamespaces } = await import("./types-xaml.ts");
  registerEntityNamespaces(["MoneyForwardCrossPlatform"]);
  const ns = new Map([["sd", "clr-namespace:System.Data;assembly=Studio.Generated.TypedDataTable2"], ["m", "clr-namespace:MoneyForwardCrossPlatform;assembly=DataService.MoneyForwardCrossPlatform"]]);
  assert.deepEqual(irType("sd:DataTable2", ns), { type: "DataTable" });
  assert.deepEqual(irType("m:MfFamilyIncomeExpense", ns), { type: "MoneyForwardCrossPlatform.MfFamilyIncomeExpense" });
});
