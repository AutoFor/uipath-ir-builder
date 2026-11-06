// Coded（C#）で対応表の無いアクティビティを XAML 経由で呼ぶ仕組みのテスト（coded-via-xaml.ts、generate-coded.ts の viaXaml）。
//
//   node --test tools/ir/coded-via-xaml.test.ts
//
// スナップショット（samples/generated-coded/<pkg>/_xaml/）は samples.test.ts が見る。ここでは引数の決め方、警告、使えない形を見る。

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { loadCatalog } from "./catalog.ts";
import { generateCoded } from "./generate-coded.ts";
import { generateChecked } from "./generate.ts";
import { loadMappings } from "./mapping.ts";
import { exprNames, viaXamlArgs } from "./coded-via-xaml.ts";
import { DEFAULT_CATALOG_FILES, noCodedApiPackages } from "./versions.ts";
import type { Node, Workflow } from "./types.ts";

const root = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const cat = loadCatalog(root, DEFAULT_CATALOG_FILES);
const { maps } = loadMappings(root);
const read = (f: string): Workflow => JSON.parse(readFileSync(join(root, f), "utf8").replace(/^﻿/, ""));
const via = { dir: "coded/_xaml" };

test("式の名前：文字列リテラルの中は数えず、$\"{}\" の中は数える。メンバーと名前付き引数は数えない", () => {
  assert.deepEqual(exprNames('"label " & label & " count"'), ["label"]);
  assert.deepEqual(exprNames('"a ""q"" b" & x'), ["x"]);
  assert.deepEqual(exprNames('$"Hello {name}, {{literal}} {n + 1}"'), ["name", "n"]);
  assert.deepEqual(exprNames("row.Item(\"Name\").ToString"), ["row"]);
  assert.deepEqual(exprNames("f(x:=1, y)"), ["f", "y"]);
  assert.deepEqual(exprNames('"a"c = ch'), ["ch"]); // VB の文字リテラル
  assert.deepEqual(exprNames('$"{a}" + "b\\"c" + d', "cs"), ["a", "d"]);
  assert.deepEqual(exprNames('@"x""y" + \'q\' + e', "cs"), ["e"]);
  assert.deepEqual(exprNames("dict!key + 1.5"), ["dict"]);
});

test("引数：読むだけは In、書き込むものは InOut、中で宣言したものは数えない（大文字小文字は区別しない）", () => {
  const n: Node = {
    act: "Sequence", variables: [{ name: "inner", type: "String" }],
    body: [
      { act: "Assign", props: { To: "Label", Value: '"x" & count.ToString & inner' } },
      { act: "ForEach", typeArg: "String", props: { Values: "names" }, body: [{ act: "LogMessage", props: { Level: "Info", Message: "item & unused_literal" } }] },
      { act: "TryCatch", body: [{ act: "LogMessage", props: { Message: { lit: "count は数えない" } } }], catches: [{ type: "Exception", body: [{ act: "LogMessage", props: { Message: "exception.Message" } }] }] },
    ],
  };
  const sc = new Map([["label", "String"], ["count", "Int32"], ["names", "String[]"], ["item", "Object"], ["exception", "Exception"], ["other", "Int32"]]);
  const r = viaXamlArgs(n, cat, sc);
  assert.deepEqual(r.issues, []);
  assert.deepEqual(r.args, [
    { name: "label", type: "String", dir: "InOut" },
    { name: "count", type: "Int32", dir: "In" },
    { name: "names", type: "String[]", dir: "In" },
  ]);
});

test("引数：enum のメンバー名と属性の値は式として読まない。out のプロパティの代入先は InOut", () => {
  const n: Node = { act: "LogMessage", props: { Level: "Info", Message: "Info" } };
  // Level の "Info" は enum。Message の Info は式なので、同じ名前の変数があれば数える
  assert.deepEqual(viaXamlArgs(n, cat, new Map([["info", "String"]])).args, [{ name: "info", type: "String", dir: "In" }]);
  const rd: Node = { act: "ReadTextFile", props: { FileName: "path", Content: "txt" } };
  assert.deepEqual(viaXamlArgs(rd, cat, new Map([["path", "String"], ["txt", "String"]])).args, [
    { name: "path", type: "String", dir: "In" },
    { name: "txt", type: "String", dir: "InOut" },
  ]);
});

test("引数：XAML に書けない型は CODED_VIA_XAML_TYPE", () => {
  const n: Node = { act: "LogMessage", props: { Message: "app.ToString" } };
  const r = viaXamlArgs(n, cat, new Map([["app", "Some.Unknown.Type"]]));
  assert.deepEqual(r.issues.map((i) => i.code), ["CODED_VIA_XAML_TYPE"]);
});

test("viaXaml を渡さなければ、これまでどおり NO_MAPPING", () => {
  const r = generateCoded(read("samples/ir-invalid-coded/NoMapping.json"), cat, maps, { namespace: "N" });
  assert.ok(r.issues.some((i) => i.code === "NO_MAPPING"));
  assert.deepEqual(r.xamls, []);
});

test("対応表の無いアクティビティは XAML 経由：RunWorkflow、戻りの辞書、CODED_VIA_XAML の注意", () => {
  const wf = read("samples/ir/UiPath.System.Activities/IfElseIfV2.min.json");
  const r = generateCoded(wf, cat, maps, { namespace: "N", viaXaml: via });
  assert.deepEqual(r.issues, []);
  assert.deepEqual(r.warnings.map((w) => [w.code, w.path]), [["CODED_VIA_XAML", "body[0]"]]);
  assert.equal(r.xamls.length, 1);
  assert.equal(r.xamls[0].path, "coded/_xaml/IfElseIfV2_Min_1.xaml");
  assert.deepEqual(r.xamls[0].wf.arguments, [{ name: "count", dir: "In", type: "Int32" }, { name: "label", dir: "InOut", type: "String" }]);
  assert.match(r.code, /var __xaml1 = RunWorkflow\("coded\/_xaml\/IfElseIfV2_Min_1\.xaml", new Dictionary<string, object> \{ \["count"\] = count, \["label"\] = label \}\);/);
  assert.match(r.code, /label = \(String\)__xaml1\["label"\];/);
  // XAML は部分木だけ（ルートの Sequence の中に IfElseIfV2 が1つ）
  const x = generateChecked(r.xamls[0].wf, cat);
  assert.deepEqual(x.issues, []);
  assert.match(x.xaml, /x:Class="IfElseIfV2_Min_1"/);
  assert.match(x.xaml, /<x:Property Name="label" Type="InOutArgument\(x:String\)" \/>/);
  assert.doesNotMatch(x.xaml, /LogMessage/);
  // 式の言語が C# のプロジェクトでは、XAML も C# の式になる
  const cs = generateChecked(r.xamls[0].wf, cat, { language: "CSharp" });
  assert.deepEqual(cs.issues, []);
  assert.match(cs.xaml, /ExpressionActivityEditor="C#"/);
});

test("連番はワークフローの中で XAML 経由のものごと。読むだけなら戻りを受けない", () => {
  const wf: Workflow = {
    workflow: "Two", variables: [{ name: "n", type: "Int32", default: "1" }],
    body: [
      { act: "IfElseIfV2", props: { Condition: "n > 0" }, then: [{ act: "LogMessage", props: { Message: '"a" & n.ToString' } }] },
      { act: "IfElseIfV2", props: { Condition: "True" }, then: [{ act: "LogMessage", props: { Message: { lit: "b" } } }] },
    ],
  };
  const r = generateCoded(wf, cat, maps, { namespace: "N", viaXaml: { dir: "_xaml" } });
  assert.deepEqual(r.xamls.map((x) => x.path), ["_xaml/Two_1.xaml", "_xaml/Two_2.xaml"]);
  assert.match(r.code, /^\s+RunWorkflow\("_xaml\/Two_1\.xaml", new Dictionary<string, object> \{ \["n"\] = n \}\);$/m);
  assert.match(r.code, /^\s+RunWorkflow\("_xaml\/Two_2\.xaml", null\);$/m);
});

test("Coded API の無いパッケージ（noApi）は、対応表があっても XAML 経由。coded: null の対応表も XAML 経由", () => {
  const wf = read("samples/ir/UiPath.Testing.Activities/VerifyExpression.min.json");
  const withApi = generateCoded(wf, cat, maps, { namespace: "N", viaXaml: via });
  assert.match(withApi.code, /testing\.VerifyExpression/); // 対応表を優先
  assert.deepEqual(withApi.xamls, []);
  const noApi = generateCoded(wf, cat, maps, { namespace: "N", viaXaml: { ...via, noApi: ["UiPath.Testing.Activities"] } });
  assert.deepEqual(noApi.issues, []);
  assert.doesNotMatch(noApi.code, /testing\./);
  assert.equal(noApi.xamls.length, 1);
  // Persistence は既定の版でも services が無く、対応表は coded: null
  assert.ok(noCodedApiPackages(root, DEFAULT_CATALOG_FILES).includes("UiPath.Persistence.Activities"));
  const p = generateCoded(read("samples/ir/UiPath.Persistence.Activities/GetFormTasks.min.json"), cat, maps, { namespace: "N", viaXaml: { ...via, noApi: noCodedApiPackages(root, DEFAULT_CATALOG_FILES) } });
  assert.deepEqual(p.issues, []);
  assert.ok(p.xamls.length > 0);
  // viaXaml が無ければ、これまでどおり NO_CODED_API
  const q = generateCoded(read("samples/ir/UiPath.Persistence.Activities/GetFormTasks.min.json"), cat, maps, { namespace: "N" });
  assert.ok(q.issues.length && q.issues.every((i) => i.code === "NO_CODED_API"));
});

test("対応表の C# が選んだ版の API に合わない（apiCheck が理由を返す）なら、そのノードを XAML 経由にする", () => {
  const wf = read("samples/ir/UiPath.Testing.Activities/VerifyExpression.min.json");
  const r = generateCoded(wf, cat, maps, { namespace: "N", viaXaml: { ...via, apiCheck: (c) => (/testing\.VerifyExpression/.test(c) ? "この版に無い" : undefined) } });
  assert.deepEqual(r.issues, []);
  assert.doesNotMatch(r.code, /testing\./);
  assert.equal(r.xamls.length, 1);
  assert.match(r.warnings[0].message, /この版に無い/);
});

test("スコープの外に出すと検証を通らない子は、親のスコープごと XAML 経由にする", () => {
  // NClick の対応表が無いとみなす。NClick だけの XAML は UI のスコープの外になるので、NApplicationCard ごと XAML にする
  const m = new Map(maps);
  m.delete("UiPath.UIAutomation.Activities/NClick");
  const r = generateCoded(read("samples/ir/UiPath.UIAutomation.Activities/NClick.min.json"), cat, m, { namespace: "N", viaXaml: via });
  assert.deepEqual(r.issues, []);
  assert.equal(r.xamls.length, 1);
  assert.equal(r.xamls[0].wf.body[0].act, "NApplicationCard");
});

test("子の無いノードは、1つのアクティビティだけの汎用の XAML（_activities/）。値は引数で渡し、同じ形なら同じファイル", () => {
  const noApi = { ...via, noApi: ["UiPath.Testing.Activities"] };
  const wf: Workflow = {
    workflow: "Att", variables: [{ name: "p", type: "String" }, { name: "q", type: "String" }],
    body: [
      { act: "AttachDocument", props: { FilePath: "p" } },
      { act: "AttachDocument", props: { FilePath: "q" } },
      { act: "AttachDocument", props: { FilePath: "p", Tags: { vb: "New String() {\"a\"}", cs: "new string[] { \"a\" }" } } },
    ],
  };
  const r = generateCoded(wf, cat, maps, { namespace: "N", viaXaml: noApi });
  assert.deepEqual(r.issues, []);
  // 必須のプロパティだけなら <ClassName>.xaml、ほかは <ClassName>_<形のハッシュ>.xaml。1つ目と2つ目は同じファイル
  assert.deepEqual(r.xamls.map((x) => [x.kind, x.path.replace(/_[0-9a-f]{6}\.xaml$/, "_<hash>.xaml")]), [["activity", "coded/_activities/AttachDocument.xaml"], ["activity", "coded/_activities/AttachDocument_<hash>.xaml"]]);
  assert.match(r.code, /RunWorkflow\("coded\/_activities\/AttachDocument\.xaml", new Dictionary<string, object> \{ \["in_FilePath"\] = p \}\);/);
  assert.match(r.code, /RunWorkflow\("coded\/_activities\/AttachDocument\.xaml", new Dictionary<string, object> \{ \["in_FilePath"\] = q \}\);/);
  assert.deepEqual(r.xamls[0].wf.arguments, [{ name: "in_FilePath", dir: "In", type: "System.String" }]);
  assert.deepEqual(r.xamls[0].wf.body[0].props, { FilePath: "in_FilePath" });
  assert.equal(r.warnings.filter((w) => w.code === "CODED_VIA_XAML").length, 3, "注意は呼ぶところごと");
});

test("汎用の XAML：出力は戻りの辞書から受け、引数にできない値（属性）は XAML に書いて形に入れる", () => {
  const noApi = { ...via, noApi: ["UiPath.Testing.Activities"] };
  const wf = (status: string): Workflow => ({
    workflow: "G", variables: [{ name: "items", type: "List<UiPath.Testing.Core.TestDataQueueItem>" }],
    body: [{ act: "GetTestDataQueueItems", props: { QueueName: { lit: "Q" }, TestDataQueueItemStatus: status, TestDataQueueItems: "items" } }],
  });
  const a = generateCoded(wf("OnlyConsumed"), cat, maps, { namespace: "N", viaXaml: noApi });
  const b = generateCoded(wf("OnlyNotConsumed"), cat, maps, { namespace: "N", viaXaml: noApi });
  assert.deepEqual([...a.issues, ...b.issues], []);
  assert.notEqual(a.xamls[0].path, b.xamls[0].path, "属性の値が違えば別のファイル");
  assert.equal(a.xamls[0].wf.body[0].props!.TestDataQueueItemStatus, "OnlyConsumed");
  assert.match(a.code, /var __xaml1 = RunWorkflow\("coded\/_activities\/GetTestDataQueueItems_[0-9a-f]{6}\.xaml", new Dictionary<string, object> \{ \["in_QueueName"\] = "Q" \}\);\s+items = \((System\.Collections\.Generic\.)?List<UiPath\.Testing\.Core\.TestDataQueueItem>\)__xaml1\["out_TestDataQueueItems"\];/);
});
