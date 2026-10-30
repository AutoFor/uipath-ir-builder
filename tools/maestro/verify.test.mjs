// 実行: node --test "tools/maestro/*.test.mjs"（uip と SDK が要る部分は、無ければ飛ばす）
import assert from "node:assert/strict";
import { copyFileSync, existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { after, test } from "node:test";
import { fileURLToPath } from "node:url";
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

test("planSteps は BPMN に format を入れ、Case は --strict にする", () => {
  assert.deepEqual(planSteps({ family: "bpmn", source: true }, "i", "a").map((s) => s.name), ["check", "compile", "format", "validate"]);
  assert.ok(planSteps({ family: "case", source: true }, "i", "a")[2].args.includes("--strict"));
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
