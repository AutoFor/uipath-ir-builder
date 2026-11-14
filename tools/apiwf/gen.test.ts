import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { generate, jsExpr, type Ir, type Stubber } from "./gen.ts";

// registry stub の代わり（CLI を呼ばない）。HTTP Request の形を真似る
const fakeStub: Stubber = (typeId, o) => ({
  SlotKey: `Stub_${o.instance}`, ExportBucketKey: `stub_${o.instance}`,
  Activity: { [`Stub_${o.instance}`]: { call: "UiPath.Http", with: { connectionId: o.connection ?? "ImplicitConnection", bodyParameters: { ...o.inputs } }, metadata: { activityType: "Connector", displayName: typeId } } },
});

const step = (wf: any, i = 1) => wf.do[0].Sequence_1.do[i];
const id = (s: string) => s;

test("WorkflowStart が先頭、ルートは Sequence_1", () => {
  const { workflow, issues } = generate({ body: [] });
  assert.deepEqual(issues, []);
  const root = (workflow as any).do[0].Sequence_1;
  assert.equal(Object.keys(root.do[0])[0], "WorkflowStart");
  assert.equal(root.do[0].WorkflowStart.metadata.isTransparent, true);
});

test("Assign：1 つに 1 変数、文字列のリテラルは ${'…'}、数はそのまま、式は ${…}", () => {
  const ir: Ir = { variables: { a: "string", b: "number", c: "number" }, body: [{ assign: "a", value: { lit: "GOLD" } }, { assign: "b", value: 3 }, { assign: "c", value: "$context.variables.b + 1" }] };
  const { workflow, issues } = generate(ir);
  assert.deepEqual(issues, []);
  assert.deepEqual(step(workflow, 1).Assign_1.set, { a: "${'GOLD'}" });
  assert.deepEqual(step(workflow, 2).Assign_2.set, { b: 3 });
  assert.deepEqual(step(workflow, 3).Assign_3.set, { c: "${$context.variables.b + 1}" });
  assert.equal(step(workflow, 1).Assign_1.metadata.isTransparent, false);
});

test("宣言していない変数への Assign は弾く", () => {
  assert.deepEqual(generate({ body: [{ assign: "x", value: 1 }] }).issues.map((i) => i.code), ["UNDECLARED_VAR"]);
});

test("If は #Wrapper / #Then / #Else、分岐は then: exit", () => {
  const { workflow } = generate({ body: [{ if: "1 > 0", then: [{ js: "return 1;" }], else: [] }] });
  const w = step(workflow)["If_1#Wrapper"];
  assert.equal(w.do[0].If_1.switch[0].case.when, "${1 > 0}");
  assert.equal(w.do[1]["If_1#Then"].then, "exit");
  assert.equal(w.do[2]["If_1#Else"].then, "exit");
  assert.ok(w.do[1]["If_1#Then"].do[0].Javascript_1);
});

test("ForEach：#Body と添字でリセットする集め方、入れ子は名前を変える", () => {
  const { workflow, issues } = generate({ body: [{ forEach: "[1,2]", body: [{ forEach: "[3]", body: [] }] }] });
  assert.deepEqual(issues, []);
  const f = step(workflow).For_Each_1;
  assert.deepEqual(f.for, { each: "currentItem", in: "${[1,2]}", at: "currentItemIndex" });
  assert.match(f.do[0]["For_Each_1#Body"].export.as, /\$currentItemIndex == 0/);
  assert.equal(f.do[0]["For_Each_1#Body"].do[0].For_Each_2.for.each, "currentItem2");
});

test("同じ名前の入れ子のループは弾く", () => {
  const ir: Ir = { body: [{ forEach: "[1]", item: "x", body: [{ forEach: "[2]", item: "x", body: [] }] }] };
  assert.ok(generate(ir).issues.some((i) => i.code === "SHADOWED_LOOP_NAME"));
});

test("Break は文字列の \"true\"、set なし、ループの外は弾く", () => {
  const { workflow } = generate({ body: [{ doWhile: "false", body: [{ break: true }] }] });
  const b = step(workflow).Do_While_1.do[0]["Do_While_1#Body"].do[0].Break_1;
  assert.deepEqual([b.break, b.then, "set" in b], ["true", "exit", false]);
  assert.equal(step(workflow).Do_While_1.for.in, "${ [1] }");
  assert.deepEqual(generate({ body: [{ break: true }] }).issues.map((i) => i.code), ["BREAK_OUTSIDE_LOOP"]);
});

test("Response：オブジェクトは ${{ … }} の 1 つの式、markJobAsFailed は横、then: end", () => {
  const { workflow } = generate({ body: [{ response: { total: "$context.variables.t", status: { lit: "ok" }, n: 1 } }] });
  const r = step(workflow).Response_1;
  assert.equal(r.response, "${{ total: $context.variables.t, status: 'ok', n: 1 }}");
  assert.equal(r.markJobAsFailed, false);
  assert.equal(r.then, "end");
});

test("@id は $context.outputs.<キー>、無い id は弾く", () => {
  const { workflow, issues } = generate({ body: [{ id: "a", js: "return 1;" }, { response: "@a + 1" }] });
  assert.deepEqual(issues, []);
  assert.equal(step(workflow, 2).Response_1.response, "${$context.outputs.Javascript_1 + 1}");
  assert.deepEqual(generate({ body: [{ response: "@nope" }] }).issues.map((i) => i.code), ["UNKNOWN_REF"]);
});

test("File to Base64 / Base64 to File は $helpers.file の 1 行", () => {
  const { workflow } = generate({ body: [{ id: "b", fileToBase64: "$workflow.input.doc" }, { base64ToFile: "@b.output", fileName: { lit: "a.pdf" } }] });
  assert.equal(step(workflow, 1).FileToBase64_1.run.script.code, "return { output: await $helpers.file.fileToBase64($workflow.input.doc) }");
  assert.equal(step(workflow, 2).Base64ToFile_1.run.script.code, "return { output: await $helpers.file.base64ToFile({ base64: $context.outputs.FileToBase64_1.output, fileName: 'a.pdf' }) }");
  assert.equal(step(workflow, 1).FileToBase64_1.metadata.activityType, "FileToBase64");
});

test("file の入力は JobAttachment の $ref と definitions", () => {
  const { workflow } = generate({ inputs: { doc: "file", n: "number" }, body: [] });
  const d = (workflow as any).input.schema.document;
  assert.deepEqual(d.properties.doc, { $ref: "#/definitions/job-attachment" });
  assert.equal(d.definitions["job-attachment"]["x-uipath-resource-kind"], "JobAttachment");
});

test("stub：SlotKey をキーに、@id は ExportBucketKey、入力のリテラルは素のまま・式は ${…}", () => {
  const { workflow, issues } = generate({ body: [{ id: "h", stub: "T", inputs: { method: { lit: "GET" }, url: "'https://x/' + 1" } }, { response: "@h.content" }] }, undefined, fakeStub);
  assert.deepEqual(issues, []);
  assert.deepEqual(step(workflow, 1).Stub_1.with.bodyParameters, { method: "GET", url: "${'https://x/' + 1}" });
  assert.equal(step(workflow, 2).Response_1.response, "${$context.outputs.stub_1.content}");
  assert.deepEqual(generate({ body: [{ stub: "T" }] }).issues.map((i) => i.code), ["NO_STUBBER"]);
});

test("jsExpr：文字列のリテラルは ' をエスケープ", () => {
  assert.equal(jsExpr({ lit: "it's" }, id), "'it\\'s'");
  assert.equal(jsExpr([1, { lit: "a" }], id), "[1, 'a']");
});

test("見本の IR は全部 issue なしで生成できる", () => {
  const dir = new URL("../../samples/apiwf/", import.meta.url);
  for (const f of readdirSync(dir).filter((x) => x.endsWith(".json") && !x.endsWith(".expected.json") && !x.endsWith(".input.json"))) {
    const { issues } = generate(JSON.parse(readFileSync(new URL(f, dir), "utf8")), undefined, fakeStub);
    assert.deepEqual(issues, [], f);
  }
});
