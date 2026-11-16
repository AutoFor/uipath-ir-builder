// テストケース（tools/ir/testcase.ts）のテスト。node --test tools/ir/testcase.test.ts
import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync, writeFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { expandTestCase, findProjectDir, registerTestCases, codedTestCaseIssues, variationPath } from "./testcase.ts";
import type { Workflow } from "./types.ts";

const log = (m: string) => ({ act: "LogMessage", props: { Level: "Info", Message: { lit: m } } });

test("expandTestCase：Given / When / Then を、その名前の Sequence 3 つの body に開く", () => {
  const r = expandTestCase({ workflow: "T", testCase: true, given: [log("g")], then: [log("t")] } as unknown as Workflow);
  assert.deepEqual(r.issues, []);
  assert.deepEqual(r.wf.body.map((n) => [n.act, n.name, n.body?.length]), [["Sequence", "Given", 1], ["Sequence", "When", 0], ["Sequence", "Then", 1]]);
  assert.equal("given" in r.wf, false);
});

test("expandTestCase：Given / When / Then の無いテストケースと、ふつうのワークフローはそのまま", () => {
  const wf = { workflow: "T", testCase: true, body: [log("x")] } as Workflow;
  assert.equal(expandTestCase(wf).wf, wf);
  const plain = { workflow: "M", body: [log("x")] } as Workflow;
  assert.equal(expandTestCase(plain).wf, plain);
});

test("expandTestCase：テストケースでない・body と一緒・status や id の誤りはエラー", () => {
  const codes = (wf: unknown) => expandTestCase(wf as Workflow).issues.map((i) => i.path);
  assert.deepEqual(codes({ workflow: "T", given: [log("g")] }), ["given"]);
  assert.deepEqual(codes({ workflow: "T", testCase: false, when: [log("w")] }), ["when"]);
  assert.deepEqual(codes({ workflow: "T", testCase: true, body: [log("b")], then: [log("t")] }), ["body"]);
  assert.deepEqual(codes({ workflow: "T", testCase: { status: "Done", id: "x" }, body: [] }), ["testCase.status", "testCase.id"]);
});

function project(extra: object = {}, bom = true) {
  const dir = mkdtempSync(join(tmpdir(), "tc-"));
  const pj = { name: "P", main: "Main.xaml", designOptions: { outputType: "Tests", fileInfoCollection: [] }, ...extra };
  writeFileSync(join(dir, "project.json"), (bom ? "﻿" : "") + JSON.stringify(pj, null, 2).replace(/\n/g, "\r\n"), "utf8");
  return dir;
}
const read = (dir: string) => readFileSync(join(dir, "project.json"), "utf8");
const list = (dir: string) => JSON.parse(read(dir).replace(/^﻿/, "")).designOptions.fileInfoCollection;

test("registerTestCases：テストケースを載せ、作り直しても testCaseId を変えない。BOM と CRLF はそのまま", () => {
  const dir = project();
  try {
    const wf = { workflow: "T", testCase: true, body: [] } as Workflow;
    assert.deepEqual(registerTestCases(dir, [{ fileName: "T.xaml", wf }, { fileName: "M.xaml", wf: { workflow: "M", body: [] } }]), ["T.xaml"]);
    const [e] = list(dir);
    assert.equal(e.fileName, "T.xaml");
    assert.equal(e.editingStatus, "Publishable");
    assert.match(e.testCaseId, /^[0-9a-f-]{36}$/);
    assert.ok(read(dir).startsWith("﻿") && read(dir).includes("\r\n"));
    // 同じ IR で作り直しても変えない（書き換えもしない）
    assert.deepEqual(registerTestCases(dir, [{ fileName: "T.xaml", wf }]), []);
    assert.equal(list(dir)[0].testCaseId, e.testCaseId);
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test("registerTestCases：IR の id と status を使い、テストケースでなくなったものは外す。サブフォルダは \\ で書く", () => {
  const id = "11111111-2222-3333-4444-555555555555";
  const dir = project({ designOptions: { fileInfoCollection: [{ editingStatus: "InProgress", testCaseId: "old", fileName: "coded\\C.cs" }, { editingStatus: "Publishable", testCaseId: "x", fileName: "Old.xaml" }] } }, false);
  try {
    const changed = registerTestCases(dir, [
      { fileName: "coded/C.cs", wf: { workflow: "C", testCase: { id, status: "Publishable" }, body: [] } as Workflow },
      { fileName: "Old.xaml", wf: { workflow: "Old", body: [] } },
    ]);
    assert.deepEqual(changed, ["coded\\C.cs", "Old.xaml"]);
    assert.deepEqual(list(dir), [{ editingStatus: "Publishable", testCaseId: id, fileName: "coded\\C.cs" }]);
    assert.ok(!read(dir).startsWith("﻿"));
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

const dataWf = (data: unknown, extra: object = {}) => ({
  workflow: "TC", arguments: [{ name: "a", dir: "In", type: "Int32" }, { name: "o", dir: "Out", type: "Int32" }],
  testCase: { data }, body: [], ...extra,
}) as unknown as Workflow;

test("expandTestCase：data の行のキーは In 引数、値は基本の型だけ。空・配列でないものはエラー", () => {
  const paths = (wf: Workflow) => expandTestCase(wf).issues.map((i) => i.path);
  assert.deepEqual(paths(dataWf([{ a: 1 }, { a: "x" }, { a: null }])), []);
  assert.deepEqual(paths(dataWf([])), ["testCase.data"]);
  assert.deepEqual(paths(dataWf({ a: 1 })), ["testCase.data"]);
  assert.deepEqual(paths(dataWf([{ o: 1 }, { b: 2 }, 3, {}])), ["testCase.data[0].o", "testCase.data[1].b", "testCase.data[2]", "testCase.data[3]"]);
  assert.deepEqual(paths(dataWf([{ a: { x: 1 } }])), ["testCase.data[0].a"]);
});

test("codedTestCaseIssues：data のある Coded のテストケースには注意を出す", () => {
  assert.deepEqual(codedTestCaseIssues(dataWf([{ a: 1 }])).map((i) => i.code), ["TESTCASE_NO_DATA"]);
  assert.deepEqual(codedTestCaseIssues({ workflow: "T", testCase: true, body: [] } as Workflow), []);
});

test("registerTestCases：data を .variations\\<名前>.json に書いて dataVariationFilePath にし、data を消すと外す", () => {
  const dir = project();
  try {
    assert.equal(variationPath("sub\\TC.xaml"), ".variations\\TC.json");
    assert.deepEqual(registerTestCases(dir, [{ fileName: "TC.xaml", wf: dataWf([{ a: 1 }, { a: 2 }]) }]), ["TC.xaml"]);
    assert.equal(list(dir)[0].dataVariationFilePath, ".variations\\TC.json");
    const vf = join(dir, ".variations", "TC.json");
    assert.deepEqual(JSON.parse(readFileSync(vf, "utf8")), [{ a: 1 }, { a: 2 }]);
    // 同じなら何も変えない。行を変えればファイルだけ変わる
    assert.deepEqual(registerTestCases(dir, [{ fileName: "TC.xaml", wf: dataWf([{ a: 1 }, { a: 2 }]) }]), []);
    assert.deepEqual(registerTestCases(dir, [{ fileName: "TC.xaml", wf: dataWf([{ a: 3 }]) }]), ["TC.xaml"]);
    assert.deepEqual(JSON.parse(readFileSync(vf, "utf8")), [{ a: 3 }]);
    // data を消すと、この道具の付けた dataVariationFilePath を外す
    assert.deepEqual(registerTestCases(dir, [{ fileName: "TC.xaml", wf: { workflow: "TC", testCase: true, body: [] } as Workflow }]), ["TC.xaml"]);
    assert.equal("dataVariationFilePath" in list(dir)[0], false);
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test("registerTestCases：Studio で付けたほかのデータ（Excel など）の dataVariationFilePath は残す", () => {
  const dir = project({ designOptions: { fileInfoCollection: [{ editingStatus: "Publishable", testCaseId: "11111111-2222-3333-4444-555555555555", dataVariationFilePath: ".variations\\Book_1.json", fileName: "TC.xaml" }] } });
  try {
    assert.deepEqual(registerTestCases(dir, [{ fileName: "TC.xaml", wf: { workflow: "TC", testCase: true, body: [] } as Workflow }]), []);
    assert.equal(list(dir)[0].dataVariationFilePath, ".variations\\Book_1.json");
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test("findProjectDir：--project、--out、--out の親の順に project.json を探す", () => {
  const dir = project();
  try {
    mkdirSync(join(dir, "coded"));
    assert.equal(findProjectDir(join(dir, "coded")), dir);
    assert.equal(findProjectDir(dir), dir);
    assert.equal(findProjectDir(join(dir, "coded", "x")), undefined);
  } finally { rmSync(dir, { recursive: true, force: true }); }
});
