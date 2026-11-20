// RunWorkflow の戻りの辞書のキー（workflow-outputs.ts）と、check.ts の RUN_WORKFLOW_KEY のテスト
import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { codedOutputs, xamlOutputs } from "./workflow-outputs.ts";
import { checkSource, loadContext } from "./check.ts";

const coded = (ret: string) => `public class W : CodedWorkflow\n{\n    [Workflow]\n    public ${ret} Execute(string a)\n    {\n    }\n}`;

test("codedOutputs：void は無し、1つは \"Output\"、名前付きのタプルは要素の名前", () => {
  assert.deepEqual(codedOutputs(coded("void")), []);
  assert.deepEqual(codedOutputs(coded("DataTable")), ["Output"]);
  assert.deepEqual(codedOutputs(coded("System.Collections.Generic.List<string>")), ["Output"]);
  assert.deepEqual(codedOutputs(coded("(string name, Dictionary<string, object> map)")), ["name", "map"]);
  assert.deepEqual(codedOutputs(coded("(string, int)")), ["Item1", "Item2"]);
  assert.deepEqual(codedOutputs(coded("Task")), []);
  assert.deepEqual(codedOutputs(coded("Task<DataTable>")), ["Output"]);
  assert.equal(codedOutputs("public class X { }"), undefined);
});

test("xamlOutputs：Out / InOut 引数の名前（In は入れない）", () => {
  const x = `<Activity><x:Members>
    <x:Property Name="InputRecords" Type="InArgument(scg:IList(x:Object))" />
    <x:Property Name="OutputRecords" Type="OutArgument(scg:IList(x:Object))" />
    <x:Property Name="Count" Type="InOutArgument(x:Int32)" />
  </x:Members></Activity>`;
  assert.deepEqual(xamlOutputs(x), ["OutputRecords", "Count"]);
});

test("check.ts の RUN_WORKFLOW_KEY：Coded に変えた先を古い引数の名前で読むとエラー、\"Output\" なら通る", () => {
  const dir = mkdtempSync(join(tmpdir(), "rwkey-"));
  try {
    mkdirSync(join(dir, "coded"));
    writeFileSync(join(dir, "coded", "Download.cs"), coded("DataTable"));
    writeFileSync(join(dir, "Old.xaml"), `<Activity><x:Members><x:Property Name="Rows" Type="OutArgument(x:Int32)" /></x:Members></Activity>`);
    const ctx = { ...loadContext(), projectDir: dir };
    const caller = (key: string, path = "coded\\\\Download.cs") =>
      `public class Caller : CodedWorkflow\n{\n    [Workflow]\n    public void Execute()\n    {\n        var r = RunWorkflow("${path}");\n        // r["コメントの中は見ない"]\n        var t = r["${key}"];\n    }\n}`;
    const codes = (src: string) => checkSource(src, join(dir, "Caller.cs"), ctx).issues.filter((i) => i.code === "RUN_WORKFLOW_KEY");
    const bad = codes(caller("ExtractData"));
    assert.equal(bad.length, 1);
    assert.equal(bad[0].severity, "error");
    assert.match(bad[0].message, /"Output"/);
    assert.equal(bad[0].line, 8);
    assert.deepEqual(codes(caller("Output")), []);
    assert.deepEqual(codes(caller("Rows", "Old.xaml")), []);
    assert.equal(codes(caller("Output", "Old.xaml")).length, 1);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
