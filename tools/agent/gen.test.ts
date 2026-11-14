import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { generate, tokenize, writeProject, type AgentIR, type ProcessLookup } from "./gen.ts";
import { toIR } from "./to-ir.ts";

// uip agent init が作る agent.json の要るところ
const BASE = {
  version: "1.2.0",
  settings: { model: "gpt-5.4", maxTokens: 128000, temperature: 0, engine: "basic-v2", maxIterations: 25, mode: "standard" },
  metadata: { storageVersion: "50.0.0", isConversational: false, showProjectCreationExperience: false, targetRuntime: "pythonAgent" },
  type: "lowCode",
  projectId: "11111111-1111-1111-1111-111111111111",
};
const CONV_BASE = { ...BASE, settings: { ...BASE.settings, engine: "conversational-v1", maxIterations: 8 }, metadata: { ...BASE.metadata, isConversational: true } };

// uip solution resources list / get の代わり（テナントを呼ばない）
const fakeLookup: ProcessLookup = (name, folder) =>
  name === "Missing" ? { error: "見つからない" } : {
    key: "2B4B9AE2-B44C-457F-92D6-B60E48D754A6", name, type: "api", folder: folder ?? "Shared",
    inputSchema: { type: "object", properties: { items: { type: "array" }, limit: { type: "number" } } },
    outputSchema: { type: "object", properties: { total: { type: "number" }, tier: { type: "string" } } },
  };

const ir = (over: Partial<AgentIR> = {}): AgentIR => ({ name: "A", system: "あなたは係です。", user: "入力: {{input.text}}", input: { text: "string" }, output: { answer: "string" }, ...over });

test("tokenize：{{…}} は variable、@{…} は expression、ほかは simpleText", () => {
  assert.deepEqual(tokenize("a {{input.x}}{{ input.y }} @{tools.P} b"), [
    { type: "simpleText", rawString: "a " },
    { type: "variable", rawString: "input.x" },
    { type: "variable", rawString: "input.y" },
    { type: "simpleText", rawString: " " },
    { type: "expression", rawString: "tools.P" },
    { type: "simpleText", rawString: " b" },
  ]);
  assert.deepEqual(tokenize(""), []);
});

test("自律型：設定・スキーマ・メッセージ。入力は既定で必須、出力は required を書いたものだけ", () => {
  const { result, problems } = generate(ir({ model: "gpt-5.4-mini-2026-03-17", input: { text: "string", n: { type: "number", required: false } }, output: { answer: { type: "string", required: true }, note: "string" } }), BASE);
  assert.deepEqual(problems, []);
  const a = result!.agent as any;
  assert.equal(a.settings.model, "gpt-5.4-mini-2026-03-17");
  assert.equal(a.settings.maxTokens, 128000); // 書かなければ init のまま
  assert.equal(a.projectId, BASE.projectId);
  assert.deepEqual(a.inputSchema, { type: "object", properties: { text: { type: "string" }, n: { type: "number" } }, required: ["text"] });
  assert.deepEqual(a.outputSchema, { type: "object", properties: { answer: { type: "string" }, note: { type: "string" } }, required: ["answer"] });
  assert.deepEqual(a.messages[1].contentTokens, [{ type: "simpleText", rawString: "入力: " }, { type: "variable", rawString: "input.text" }]);
  assert.equal(a.guardrails, undefined);
});

test("ファイルの入力は job-attachment の決まった定義になる", () => {
  const { result, problems } = generate(ir({ input: { doc: "file", many: "file[]", opt: { type: "file", required: false } }, user: "{{input.doc}}" }), BASE);
  assert.deepEqual(problems, []);
  const s = result!.agent.inputSchema as any;
  assert.deepEqual(s.properties.doc, { $ref: "#/definitions/job-attachment" });
  assert.deepEqual(s.properties.many, { type: "array", items: { $ref: "#/definitions/job-attachment" } });
  assert.deepEqual(s.required, ["doc", "many"]);
  assert.equal(s.definitions["job-attachment"]["x-uipath-resource-kind"], "JobAttachment");
  assert.deepEqual(s.definitions["job-attachment"].required, ["ID"]);
});

test("参照の誤りは生成の前に止める：入力に無い {{input.x}}、無い道具の @{tools.X}、{{x}} の形", () => {
  const { problems } = generate(ir({ system: "@{tools.Nope} を使う", user: "{{input.missing}} {{bare}}" }), BASE);
  assert.deepEqual(problems.map(p => p.code).sort(), ["BAD_VARIABLE", "UNKNOWN_INPUT", "UNKNOWN_RESOURCE"]);
});

test("デプロイ済みのプロセスの道具：引数の形をテナントから写し、referenceKey は小文字、folderPath はそのまま", () => {
  const { result, problems } = generate(ir({ system: "@{tools.Probe} を呼ぶ", tools: [{ process: "Probe", folder: "Shared/X", description: "合計を出す" }] }), BASE, { lookup: fakeLookup });
  assert.deepEqual(problems, []);
  const r = result!.resources.Probe as any;
  assert.equal(r.$resourceType, "tool");
  assert.equal(r.type, "api");
  assert.equal(r.location, "external");
  assert.equal(r.referenceKey, "2b4b9ae2-b44c-457f-92d6-b60e48d754a6");
  assert.deepEqual(r.properties, { processName: "Probe", folderPath: "Shared/X", exampleCalls: [] });
  assert.deepEqual(r.guardrail, { policies: [] });
  assert.equal(r.isEnabled, true);
  assert.deepEqual(r.inputSchema.properties.limit, { type: "number" });
  assert.deepEqual((result!.agent as any).messages[0].contentTokens[0], { type: "expression", rawString: "tools.Probe" });
});

test("プロセスが見つからない・--print で探せない、は誤りにする", () => {
  assert.equal(generate(ir({ tools: [{ process: "Missing" }] }), BASE, { lookup: fakeLookup }).problems[0].code, "PROCESS_NOT_FOUND");
  assert.equal(generate(ir({ tools: [{ process: "Probe" }] }), BASE).problems[0].code, "NEED_TENANT");
});

test("組み込みの道具 analyze-attachments：type internal、location を書かない、toolType", () => {
  const { result } = generate(ir({ tools: [{ builtin: "analyze-attachments" }] }), BASE);
  const r = result!.resources.AnalyzeFiles as any;
  assert.equal(r.type, "internal");
  assert.equal(r.location, undefined);
  assert.equal(r.properties.toolType, "analyze-attachments");
  assert.deepEqual(r.inputSchema.required, ["attachments", "analysisTask"]);
});

test("ガードレール：判別子つきの形。PII の道具の名前は道具に無ければ誤り", () => {
  const { result } = generate(ir({ guardrails: [{ pii: ["Email"], action: "log" }, { harmful: ["Hate"], threshold: 4 }, { promptInjection: 0.5 }] }), BASE);
  const g = (result!.agent as any).guardrails;
  assert.equal(g[0].$guardrailType, "builtInValidator");
  assert.equal(g[0].validatorType, "pii_detection");
  assert.deepEqual(g[0].action, { $actionType: "log", severityLevel: "Warning" });
  assert.deepEqual(g[0].validatorParameters[1], { $parameterType: "map-enum", id: "entityThresholds", value: { Email: 0.8 } });
  assert.equal(g[1].action.$actionType, "block");
  assert.deepEqual(g[1].validatorParameters[1].value, { Hate: 4 });
  assert.deepEqual(g[2].selector, { scopes: ["Llm"] });
  assert.equal(generate(ir({ guardrails: [{ pii: ["Email"], tools: ["Nope"] }] }), BASE).problems[0].code, "UNKNOWN_TOOL");
});

test("ガードレールの id は名前で引き継ぐ", () => {
  const old = { ...BASE, guardrails: [{ name: "PII detection guardrail", id: "keep-me" }] };
  const { result } = generate(ir({ guardrails: [{ pii: ["Email"] }] }), old);
  assert.equal((result!.agent as any).guardrails[0].id, "keep-me");
});

test("会話型：user と output は書かない。プロジェクトと種類が違えば止める", () => {
  const conv: AgentIR = { name: "C", conversational: true, system: "係です" };
  const { result, problems } = generate(conv, CONV_BASE);
  assert.deepEqual(problems, []);
  assert.deepEqual((result!.agent as any).messages[1], { role: "user", content: "", contentTokens: [] });
  assert.equal((result!.agent as any).settings.engine, "conversational-v1");
  assert.deepEqual(generate({ ...conv, user: "x", output: { a: "string" } }, CONV_BASE).problems.map(p => p.code).sort(), ["CONVERSATIONAL_OUTPUT", "CONVERSATIONAL_USER"]);
  assert.equal(generate(conv, BASE).problems[0].code, "VARIANT_MISMATCH");
});

test("評価のケース：入力・出力に無い名前は誤り。evalFiles のパスも確かめる", () => {
  const p = generate(ir({ evals: [{ name: "e", inputs: { nope: 1 }, expected: { nada: 1 } }], evalFiles: { "x.json": {} } }), BASE).problems.map(p => p.code).sort();
  assert.deepEqual(p, ["BAD_EVAL_FILE", "UNKNOWN_INPUT", "UNKNOWN_OUTPUT"]);
});

// init が作るプロジェクトの形を写したフォルダ
function scaffold(): string {
  const dir = mkdtempSync(join(tmpdir(), "agent-gen-"));
  writeFileSync(join(dir, "agent.json"), JSON.stringify(BASE));
  writeFileSync(join(dir, "project.uiproj"), JSON.stringify({ ProjectType: "Agent", Name: "x", Description: null, MainFile: null }));
  mkdirSync(join(dir, "evals", "eval-sets"), { recursive: true });
  mkdirSync(join(dir, "evals", "evaluators"), { recursive: true });
  writeFileSync(join(dir, "evals", "eval-sets", "evaluation-set-default.json"), JSON.stringify({ fileName: "evaluation-set-default.json", id: "set-1", name: "Default Evaluation Set", evaluatorRefs: [], evaluations: [] }));
  writeFileSync(join(dir, "evals", "evaluators", "evaluator-default.json"), "{}");
  return dir;
}

test("見本の IR は全部生成でき、書いて to-ir で戻すと同じ IR になる", () => {
  const dir = join(import.meta.dirname, "..", "..", "samples", "agent");
  const files = readdirSync(dir).filter(f => f.endsWith(".json"));
  assert.ok(files.length >= 3);
  for (const f of files) {
    const sample = JSON.parse(readFileSync(join(dir, f), "utf8")) as AgentIR;
    const proj = scaffold();
    try {
      const base = sample.conversational ? CONV_BASE : BASE;
      writeFileSync(join(proj, "agent.json"), JSON.stringify(base));
      const { result, problems } = generate(sample, base, { lookup: fakeLookup, project: proj });
      assert.deepEqual(problems, [], f);
      writeProject(proj, sample, result!);
      assert.deepEqual(toIR(proj), sample, f);
    } finally { rmSync(proj, { recursive: true, force: true }); }
  }
});

test("作り直すと resource と評価の id を引き継ぎ、IR から消した道具・評価ファイルは消える", () => {
  const proj = scaffold();
  try {
    const first = ir({ tools: [{ builtin: "analyze-attachments" }], evals: [{ name: "e1", inputs: { text: "a" }, expected: { answer: "b" } }], evalFiles: { "evaluators/extra.json": { id: "x" } } });
    writeProject(proj, first, generate(first, BASE, { project: proj }).result!);
    const id1 = JSON.parse(readFileSync(join(proj, "resources", "AnalyzeFiles", "resource.json"), "utf8")).id;
    const ev1 = JSON.parse(readFileSync(join(proj, "evals", "eval-sets", "evaluation-set-default.json"), "utf8")).evaluations[0].id;
    writeProject(proj, first, generate(first, BASE, { project: proj }).result!);
    assert.equal(JSON.parse(readFileSync(join(proj, "resources", "AnalyzeFiles", "resource.json"), "utf8")).id, id1);
    assert.equal(JSON.parse(readFileSync(join(proj, "evals", "eval-sets", "evaluation-set-default.json"), "utf8")).evaluations[0].id, ev1);
    const second = ir();
    writeProject(proj, second, generate(second, BASE, { project: proj }).result!);
    assert.equal(existsSync(join(proj, "resources", "AnalyzeFiles")), false);
    assert.equal(existsSync(join(proj, "evals", "evaluators", "extra.json")), false);
    assert.equal(existsSync(join(proj, "evals", "evaluators", "evaluator-default.json")), true);
  } finally { rmSync(proj, { recursive: true, force: true }); }
});

test("to-ir：本文は contentTokens から組み直す（古い形の {{Content}} を {{input.Content}} にする）", () => {
  const proj = scaffold();
  try {
    writeFileSync(join(proj, "agent.json"), JSON.stringify({ ...BASE, inputSchema: { type: "object", properties: { Content: { type: "string" } } }, outputSchema: { type: "object", properties: {} },
      messages: [{ role: "system", content: "s", contentTokens: [{ type: "simpleText", rawString: "s" }] },
        { role: "user", content: "見る {{Content}}", contentTokens: [{ type: "simpleText", rawString: "見る " }, { type: "variable", rawString: "input.Content" }] }] }));
    const back = toIR(proj);
    assert.equal(back.user, "見る {{input.Content}}");
    assert.deepEqual(back.input, { Content: { type: "string", required: false } });
    assert.deepEqual(generate(back, BASE).problems, []);
  } finally { rmSync(proj, { recursive: true, force: true }); }
});
