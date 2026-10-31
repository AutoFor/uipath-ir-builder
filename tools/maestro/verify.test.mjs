// 実行: node --test "tools/maestro/*.test.mjs"（uip と SDK が要る部分は、無ければ飛ばす）
import assert from "node:assert/strict";
import { copyFileSync, existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { after, test } from "node:test";
import { fileURLToPath } from "node:url";
import { checkRefs, extractRefs } from "./tenant-refs.mjs";
import { parseTsc, classify, dropRepeated, findUip, judge, normalizeEnvelope, parseEnvelope, parseIssueLines, planSteps, verifyFile } from "./verify.mjs";

const here = dirname(fileURLToPath(import.meta.url));

test("classify はソースと成果物を見分ける", () => {
  assert.deepEqual(classify("a/X.flow.ts"), { family: "flow", source: true, name: "X" });
  assert.deepEqual(classify("X.case.ts"), { family: "case", source: true, name: "X" });
  assert.deepEqual(classify("X.bpmn"), { family: "bpmn", source: false, name: "X" });
  assert.deepEqual(classify("caseplan.json"), { family: "case", source: false, name: "caseplan" });
  assert.equal(classify("X.ts"), null);
});

test("planSteps は Flow の式の検査を厳しくする", () => {
  const steps = planSteps({ family: "flow", source: true }, "i", "a");
  assert.deepEqual(steps.map((s) => s.name), ["check", "compile", "validate"]);
  assert.ok(steps[2].args.includes("--strict-expressions"));
  assert.ok(steps[1].args.includes("--no-check"));
});

test("extractRefs は Flow の binding とノードのキーを読む", () => {
  const flow = JSON.stringify({ nodes: [{ id: "n", type: "uipath.core.rpa-workflow.802eeeb8-d037-4b4c-badf-e6cfc39591a7" }], bindings: [
    { resource: "process", resourceKey: "F.P", default: "P", propertyAttribute: "name" },
    { resource: "process", resourceKey: "F.P", default: "F", propertyAttribute: "folderPath" },
    { resource: "connection", resourceKey: "c", default: "c", propertyAttribute: "ConnectionId" },
    { resource: "connection", resourceKey: "c", default: "f", propertyAttribute: "FolderKey" },
  ] });
  assert.deepEqual(extractRefs("flow", flow), [
    { kind: "process", name: "P", folder: "F" },
    { kind: "connection", id: "c" },
    { kind: "processKey", key: "802eeeb8-d037-4b4c-badf-e6cfc39591a7", where: "n" },
  ]);
});

test("extractRefs は BPMN の context と binding を読む", () => {
  const xml = `<uipath:binding id="o" default="c1" resource="Connection" resourceKey="c1" propertyAttribute="ConnectionId" />
    <uipath:input name="folderPath" type="string" value="F" />
    <uipath:input name="name" type="string" value="P" />`;
  assert.deepEqual(extractRefs("bpmn", xml), [{ kind: "connection", id: "c1" }, { kind: "process", name: "P", folder: "F" }]);
});

test("checkRefs は無い資源、違うフォルダ、無い接続を NG にする", () => {
  const tenant = { processes: [{ Key: "AA", Name: "P", FolderPath: "F" }], apps: [{ Key: "b", Name: "A", Folder: "F" }], connections: [{ Id: "C", Name: "c", State: "Enabled" }, { Id: "D", Name: "d", State: "Failed" }] };
  const codes = (refs) => checkRefs(refs, tenant).map((d) => d.code);
  assert.deepEqual(codes([{ kind: "process", name: "P", folder: "F" }, { kind: "processKey", key: "aa" }, { kind: "connection", id: "c" }, { kind: "app", name: "A", folder: "F", key: "B" }]), []);
  assert.deepEqual(codes([{ kind: "process", name: "X", folder: "F" }]), ["REF_NOT_FOUND"]);
  assert.deepEqual(codes([{ kind: "process", name: "P", folder: "G" }]), ["REF_WRONG_FOLDER"]);
  assert.deepEqual(codes([{ kind: "processKey", key: "zz" }]), ["REF_NOT_FOUND"]);
  assert.deepEqual(codes([{ kind: "connection", id: "x" }]), ["REF_NOT_FOUND"]);
  assert.deepEqual(codes([{ kind: "connection", id: "d" }]), ["REF_CONNECTION_STATE"]);
  assert.deepEqual(codes([{ kind: "app", name: "A", folder: "G", key: "b" }]), ["REF_WRONG_FOLDER"]);
});

test("planSteps は BPMN に format を入れ、Case は --strict にする", () => {
  assert.deepEqual(planSteps({ family: "bpmn", source: true }, "i", "a").map((s) => s.name), ["check", "compile", "format", "validate"]);
  const c = planSteps({ family: "case", source: true }, "i", "a");
  assert.deepEqual(c.map((s) => s.name), ["check", "compile", "bindings", "validate"]);
  assert.ok(c[3].args.includes("--strict"));
  assert.deepEqual(planSteps({ family: "bpmn", source: false }, "i", "a").map((s) => s.name), ["format", "validate"]);
});

test("parseIssueLines は3つの書き方を読む", () => {
  const r = parseIssueLines("2 warning(s):\n  - [review] VARIABLE_NOT_SET: 文\n  - [(xml)] unknown attribute <type>\n  - [error] [nodes[s].inputs.script] [EXPRESSION_DIAGNOSTIC] 文2");
  assert.deepEqual(r, [
    { level: "warning", code: "VARIABLE_NOT_SET", where: "review", message: "文" },
    { level: "note", code: null, where: "(xml)", message: "unknown attribute <type>" },
    { level: "error", code: "EXPRESSION_DIAGNOSTIC", where: "nodes[s].inputs.script", message: "文2" },
  ]);
});

test("normalizeEnvelope は失敗の中身を落とさない", () => {
  const fromInstructions = normalizeEnvelope({ Result: "Failure", Message: "m", Instructions: "Found 1 error(s):\n  - [error] [p] 中身" });
  assert.equal(fromInstructions[0].message, "中身");
  const noDetail = normalizeEnvelope({ Result: "Failure", Message: "m" });
  assert.equal(noDetail[0].level, "error");
  assert.equal(noDetail[0].message, "m");
  assert.equal(normalizeEnvelope({ Result: "Success", Data: {} }).length, 0);
});

test("parseEnvelope は前に余計な行があっても読み、読めなければ null", () => {
  assert.equal(parseEnvelope('[x] noise\n{"Result":"Success"}').Result, "Success");
  assert.equal(parseEnvelope("nothing"), null);
});

test("parseTsc は続きの行もまとめる", () => {
  const r = parseTsc("a.ts(3,23): error TS2769: No overload.\n  Did you mean?\n");
  assert.deepEqual(r, [{ level: "error", code: "TS2769", where: "3:23", message: "No overload. Did you mean?" }]);
});

test("dropRepeated は check と compile で同じ診断を1回にする", () => {
  const seen = new Set();
  const d = { level: "error", code: "X", where: null, message: "m" };
  assert.equal(dropRepeated([d], seen).length, 1);
  assert.equal(dropRepeated([d], seen).length, 0);
});

test("judge：warning は既定で OK、--strict で NG。note は数えない", () => {
  const steps = [{ status: "warn", diagnostics: [{ level: "warning" }, { level: "note" }] }];
  assert.deepEqual(judge(steps, false), { ok: true, errors: 0, warnings: 1 });
  assert.equal(judge(steps, true).ok, false);
  assert.equal(judge([{ status: "ng", diagnostics: [] }], false).ok, false);
});

// ---- ここから uip と SDK を実際に呼ぶ（ローカルだけ）----
const uip = findUip();
const skip = !uip || !existsSync(join(here, "node_modules", "@uipath", "maestro-builder-sdk")) ? "uip か SDK が無い" : false;
const out = mkdtempSync(join(process.env.TEMP ?? tmpdir(), "maestro-verify-"));
after(() => rmSync(out, { recursive: true, force: true }));
const broken = (n) => resolve(here, "fixtures", "broken", n);
const codes = (r, step) => r.steps.find((s) => s.name === step).diagnostics.map((d) => d.code);
const status = (r) => Object.fromEntries(r.steps.map((s) => [s.name, s.status]));

test("HITL の status は check でしか止まらない（validate は通る）", { skip }, () => {
  const r = verifyFile(uip, broken("HitlStatus.flow.ts"), out);
  assert.equal(r.ok, false);
  assert.deepEqual(codes(r, "check"), ["HITL_READ_STATUS"]);
  assert.deepEqual(status(r), { types: "ok", check: "ng", compile: "ok", validate: "ok" });
});

test("script の文法と型の間違いは validate --strict-expressions でしか止まらない", { skip }, () => {
  for (const f of ["ScriptSyntax.flow.ts", "ScriptType.flow.ts"]) {
    const r = verifyFile(uip, broken(f), out);
    assert.deepEqual(status(r), { types: "ok", check: "ok", compile: "ok", validate: "ng" }, f);
    assert.ok(codes(r, "validate").includes("EXPRESSION_DIAGNOSTIC"), f);
  }
});

test("BPMN：線の先が無いと check で止まり、後ろは skip", { skip }, () => {
  const r = verifyFile(uip, broken("MissingTarget.bpmn.ts"), out);
  assert.deepEqual(status(r), { types: "ok", check: "ng", compile: "ng", format: "skip", validate: "skip" });
  assert.deepEqual(codes(r, "check"), ["DANGLING_FLOW"]);
  assert.deepEqual(codes(r, "compile"), [], "compile の同じ診断は消す");
});

test("BPMN：終了イベントが無いものは warning だけ。--strict で NG", { skip }, () => {
  assert.equal(verifyFile(uip, broken("NoEnd.bpmn.ts"), out).ok, true);
  assert.equal(verifyFile(uip, broken("NoEnd.bpmn.ts"), out, { strict: true }).ok, false);
});

test("Case：ステージが無いもの、無いタスクを指す規則を止める", { skip }, () => {
  assert.ok(codes(verifyFile(uip, broken("NoStage.case.ts"), out), "check").includes("NO_STAGES"));
  assert.ok(codes(verifyFile(uip, broken("BadRule.case.ts"), out), "check").includes("UNKNOWN_TASK_REF"));
});

test("綴りの間違いは types が名前を出す（check は内部エラーになるだけ）", { skip }, () => {
  const r = verifyFile(uip, broken("Typo.flow.ts"), out);
  const d = r.steps.find((s) => s.name === "types").diagnostics[0];
  assert.equal(d.code, "TS2769");
  assert.match(d.message, /Did you mean to write 'code'/);
});

test("types は tools/maestro の外のソースでも SDK の型を見つける", { skip }, () => {
  const r = verifyFile(uip, resolve(here, "..", "..", "samples", "maestro", "ExpenseCase.case.ts"), out);
  assert.equal(r.steps.find((s) => s.name === "types").status, "ok", JSON.stringify(r.steps[0]));
});

test("できあがった .bpmn を渡しても、元のファイルは変えない", { skip }, () => {
  const src = resolve(here, "..", "..", "out", "maestro-verify-test-Input.bpmn");
  const first = verifyFile(uip, resolve(here, "fixtures", "ok", "Approval.bpmn.ts"), out);
  copyFileSync(first.artifact, src);
  const before = readFileSync(src, "utf8");
  const r = verifyFile(uip, src, join(out, "copy"));
  assert.deepEqual(r.steps.map((s) => s.name), ["format", "validate"]);
  assert.equal(readFileSync(src, "utf8"), before);
  rmSync(src);
});

test("穴：空の分岐はどの工程でも止まらない（SDK の版が変わって止まるようになったら、この例を見直す）", { skip }, () => {
  assert.equal(verifyFile(uip, broken("EmptyArm.flow.ts"), out).ok, true);
});

test("正しい例は pack まで通る（Flow、BPMN、Case）", { skip }, () => {
  for (const f of ["ok/Approval.flow.ts", "ok/Approval.bpmn.ts", "ok/Approval.case.ts"]) {
    const r = verifyFile(uip, resolve(here, "fixtures", f), out, { pack: true });
    assert.equal(r.ok, true, `${f}: ${JSON.stringify(r.steps)}`);
    assert.equal(r.steps.find((s) => s.name === "pack").status, "ok", f);
  }
});

test("穴：テナントに無い資源は、--tenant なしだと通る（--tenant は読み取りなので既定で流さない）", { skip }, () => {
  for (const f of ["GhostRpa.flow.ts", "GhostRpa.bpmn.ts", "GhostAgent.flow.ts", "GhostApp.flow.ts"]) {
    assert.equal(verifyFile(uip, resolve(here, "fixtures", "tenant", f), out).ok, true, f);
  }
});

// テナントを読むので、MAESTRO_TENANT=1 のときだけ流す
const tenantSkip = skip || (process.env.MAESTRO_TENANT ? false : "MAESTRO_TENANT=1 のときだけ");
test("--tenant は実在の RPA を通し、無いものを止める", { skip: tenantSkip }, () => {
  const v = (f) => verifyFile(uip, resolve(here, "fixtures", "tenant", f), out, { tenant: true });
  for (const f of ["Rpa.flow.ts", "Rpa.bpmn.ts", "Rpa.case.ts"]) assert.equal(v(f).ok, true, f);
  for (const f of ["GhostRpa.flow.ts", "GhostRpa.bpmn.ts", "GhostAgent.flow.ts", "GhostApp.flow.ts", "GhostApp.case.ts"]) {
    const r = v(f);
    assert.equal(r.ok, false, f);
    assert.ok(codes(r, "tenant").includes("REF_NOT_FOUND"), f);
  }
});
