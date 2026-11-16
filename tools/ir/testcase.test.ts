// テストケース（tools/ir/testcase.ts）のテスト。node --test tools/ir/testcase.test.ts
import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync, writeFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { expandTestCase, findProjectDir, registerTestCases } from "./testcase.ts";
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

test("findProjectDir：--project、--out、--out の親の順に project.json を探す", () => {
  const dir = project();
  try {
    mkdirSync(join(dir, "coded"));
    assert.equal(findProjectDir(join(dir, "coded")), dir);
    assert.equal(findProjectDir(dir), dir);
    assert.equal(findProjectDir(join(dir, "coded", "x")), undefined);
  } finally { rmSync(dir, { recursive: true, force: true }); }
});
