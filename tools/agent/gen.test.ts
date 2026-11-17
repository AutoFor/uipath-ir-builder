import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { combos, generate, tokenize, writeProject, type AgentIR, type AppLookup, type EntityLookup, type IsLookup, type McpLookup, type ProcessLookup } from "./gen.ts";
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

// アプリ・表・Integration Service・MCP を探す関数の代わり
const fakeApp: AppLookup = (name) => name === "Nope" ? { error: "無い" } : ({ key: "app-key", name, folder: "solution_folder",
  schema: { version: 0, inputs: [{ name: "Content", type: "System.String" }], inOuts: [{ name: "Comment", type: "System.String", description: "c" }], outputs: [], outcomes: [{ name: "approve" }, { name: "reject" }] } });
const fakeEntity: EntityLookup = (names) => ({ folderKey: "folder-key", entities: names.map(n => ({ id: "id-" + n, name: n, description: null })) });
const fakeIs: IsLookup = () => ({
  meta: { DisplayName: "Web Search", Operation: { Method: "POST", Path: "/v2/webSearch", Description: "Web search" },
    RequestFields: [{ Name: "provider", Type: "string", Enum: ["GoogleCustomSearch", "Jina"], Required: true }, { Name: "query", Type: "string", Required: true }, { Name: "num", Type: "integer" }],
    ResponseFields: [{ Name: "formattedResults", Type: "string" }, { Name: "results[*].title", Type: "string" }, { Name: "results[*].url", Type: "string" }] },
  connection: { id: "conn-id", name: "GenAI", folderKey: "fk" }, connectorName: "UiPath GenAI Activities", iconUrl: "https://example/icon" });
const fakeMcp: McpLookup = slug => ({ key: "mcp-key", slug, name: "Agent MCP Test", folder: "Shared", description: "d",
  tools: [{ name: "price_total", description: "p", inputSchema: { type: "object", properties: {} }, outputSchema: null }, { name: "other", description: "o", inputSchema: { type: "object", properties: {} }, outputSchema: null }] });
const ALL = { lookup: fakeLookup, appLookup: fakeApp, entityLookup: fakeEntity, isLookup: fakeIs, mcpLookup: fakeMcp };

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
      const { result, problems } = generate(sample, base, { ...ALL, project: proj });
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

test("エスカレーション：アプリの action schema から入出力・結果を作り、受け手はメール。無い結果や受け手なしは誤り", () => {
  const { result, problems } = generate(ir({ system: "@{escalations.Approval} に上げる", escalations: [{ app: "SimpleApprovalApp", name: "Approval", recipients: ["a@example.com"], outcomes: { reject: "end" } }] }), BASE, ALL);
  assert.deepEqual(problems, []);
  const ch = (result!.resources.Approval as any).channels[0];
  assert.deepEqual(Object.keys(ch.inputSchema.properties), ["Content", "Comment"]);
  assert.deepEqual(Object.keys(ch.outputSchema.properties), ["Comment"]);
  assert.deepEqual(ch.outcomeMapping, { approve: "continue", reject: "end" });
  assert.deepEqual(ch.recipients, [{ type: 3, value: "a@example.com" }]);
  assert.equal(ch.properties.folderName, "solution_folder");
  assert.equal(ch.properties.appVersion, 1);
  assert.equal((result!.resources.Approval as any).isEnabled, true);
  const bad = generate(ir({ escalations: [{ app: "SimpleApprovalApp", recipients: [], outcomes: { maybe: "end" } }] }), BASE, ALL).problems.map(p => p.code).sort();
  assert.deepEqual(bad, ["NO_RECIPIENT", "UNKNOWN_OUTCOME"]);
});

test("コンテキスト：インデックスは名前で、Data Fabric はフォルダの表、モードは小文字だけ", () => {
  const { result, problems } = generate(ir({ contexts: [{ index: "kb-1", folder: "Shared" }, { dataFabric: ["T"], folder: "Shared" }, { attachments: true, name: "Files" }] }), BASE, ALL);
  assert.deepEqual(problems, []);
  const idx = result!.resources.kb_1 as any;
  assert.equal(idx.contextType, "index");
  assert.equal(idx.referenceKey, null);
  assert.equal(idx.settings.retrievalMode, "semantic");
  const df = result!.resources.Entities as any;
  assert.deepEqual(df.entitySet[0], { id: "id-T", referenceKey: "id-T", name: "T", folderId: "folder-key", folderDisplayName: "Shared", description: null, entityType: "native" });
  assert.equal((result!.resources.Files as any).contextType, "attachments");
  assert.equal(generate(ir({ contexts: [{ index: "x", folder: "S", mode: "DeepRag" as any }] }), BASE, ALL).problems[0].code, "BAD_MODE");
  // Structured は 2026-09 に廃止：Data Fabric へ案内する
  const retired = generate(ir({ contexts: [{ index: "x", folder: "S", mode: "structured" as any }] }), BASE, ALL).problems[0];
  assert.equal(retired.code, "RETIRED_MODE");
  assert.match(retired.message, /dataFabric/);
});

test("Integration Service：固定の値も入力のスキーマに残し（enum を選んだ値に）、results[*] はそのままのキー", () => {
  const { result, problems } = generate(ir({ tools: [{ integration: "uipath-uipath-airdk", activity: "v2::webSearch", values: { provider: "Jina" } }] }), BASE, ALL);
  assert.deepEqual(problems, []);
  const r = result!.resources.Web_Search as any;
  assert.equal(r.type, "integration");
  assert.deepEqual(r.inputSchema.properties.provider.enum, ["Jina"]);
  assert.equal(r.inputSchema.properties.provider.oneOf.length, 2);
  assert.deepEqual(r.inputSchema.required, ["provider", "query"]);
  const prov = r.properties.parameters.find((p: any) => p.name === "provider");
  assert.equal(prov.fieldVariant, "static");
  assert.equal(prov.value, "Jina");
  assert.deepEqual(prov.enumValues, [{ name: "GoogleCustomSearch", value: "GoogleCustomSearch" }, { name: "Jina", value: "Jina" }]);
  assert.equal(r.properties.parameters.find((p: any) => p.name === "query").value, "{{prompt}}");
  assert.deepEqual(r.outputSchema.properties["results[*]"].items, { $ref: "#/definitions/results[*]" });
  assert.deepEqual(Object.keys(r.outputSchema.definitions["results[*]"].properties), ["title", "url"]);
  assert.equal(r.properties.connection.isDefault, false);
  assert.equal(r.properties.connection.solutionProperties.resourceKey, "conn-id");
  assert.equal(generate(ir({ tools: [{ integration: "x", activity: "y", values: { nope: 1 } }] }), BASE, ALL).problems[0].code, "UNKNOWN_FIELD");
});

test("MCP：名前はサーバーの表示名、tools で絞ると cached、無い道具は誤り", () => {
  const { result } = generate(ir({ tools: [{ mcp: "agent-mcp-test", tools: ["price_total"] }] }), BASE, ALL);
  const r = result!.resources["Agent MCP Test"] as any;
  assert.equal(r.$resourceType, "mcp");
  assert.equal(r.slug, "agent-mcp-test");
  assert.equal(r.folderPath, "solution_folder");
  assert.deepEqual(r.availableTools.map((t: any) => t.name), ["price_total"]);
  assert.deepEqual(r.toolsConfiguration, { discoveryMode: { type: "cached" } });
  assert.deepEqual(r.solutionProperties, { resourceKey: "mcp-key", resourceName: "Agent MCP Test" });
  const all = generate(ir({ tools: [{ mcp: "agent-mcp-test" }] }), BASE, ALL).result!.resources["Agent MCP Test"] as any;
  assert.deepEqual(all.toolsConfiguration, { discoveryMode: { type: "dynamic", allowAll: true } });
  assert.equal(generate(ir({ tools: [{ mcp: "agent-mcp-test", tools: ["zzz"] }] }), BASE, ALL).problems[0].code, "UNKNOWN_MCP_TOOL");
});

test("to-ir：メモリ（features/）を memory に戻す", () => {
  const proj = scaffold();
  try {
    mkdirSync(join(proj, "features", "PastDecisions"), { recursive: true });
    writeFileSync(join(proj, "features", "PastDecisions", "feature.json"), JSON.stringify({ $featureType: "memorySpace", name: "PastDecisions", memorySpaceName: "Mem", folderPath: "Shared",
      dynamicFewShotSettings: { isEnabled: true, threshold: 0, resultCount: 3, searchMode: "hybrid", fieldSettings: [{ name: "request", weight: 1 }] } }));
    writeFileSync(join(proj, "agent.json"), JSON.stringify({ ...BASE, messages: [{ role: "system", content: "s" }, { role: "user", content: "u" }] }));
    assert.deepEqual(toIR(proj).memory, [{ space: "Mem", folder: "Shared", name: "PastDecisions", fields: { request: 1 } }]);
  } finally { rmSync(proj, { recursive: true, force: true }); }
});

test("組み込みの道具：DeepRAG・Batch Transform・Create File は Studio Web の形を写し、task と列を入れる", () => {
  const { result, problems } = generate(ir({ tools: [
    { builtin: "deep-rag", task: "要約する", citations: false },
    { builtin: "batch-transform", task: "行ごとに分ける", columns: [{ name: "Category", description: "区分" }], webSearch: true },
    { builtin: "create-file" },
  ] }), BASE);
  assert.deepEqual(problems, []);
  const d = result!.resources.DeepRAG as any;
  assert.equal(d.properties.toolType, "deep-rag");
  assert.deepEqual(d.properties.settings.query, { variant: "static", value: "要約する" });
  assert.deepEqual(d.properties.settings.citationMode, { value: "Skip" });
  assert.equal(d.inputSchema.properties.attachment.$ref, "#/definitions/job-attachment");
  const b = result!.resources["Batch Transform"] as any;
  assert.deepEqual(b.properties.settings.outputColumns, [{ name: "Category", description: "区分" }]);
  assert.deepEqual(b.properties.settings.webSearchGrounding, { value: "Enabled" });
  assert.equal((result!.resources["Create File"] as any).properties.toolType, "create-file");
  const bad = generate(ir({ tools: [{ builtin: "batch-transform", task: "", columns: [] } as any, { builtin: "nope" } as any] }), BASE).problems.map(p => p.code).sort();
  assert.deepEqual(bad, ["BAD_BUILTIN", "MISSING"]);
});

test("IXP の道具と書類の確認（Document Validation Task）：tags は staging / live、確認は tools の IXP の道具を指す", () => {
  const { result, problems } = generate(ir({ tools: [{ ixp: "ixp_trial_invoices", tag: "staging" }], escalations: [{ validate: "ixp_trial_invoices", bucket: "B", bucketFolder: "Shared", recipients: ["a@example.com"] }] }), BASE);
  assert.deepEqual(problems, []);
  const tool = result!.resources.ixp_trial_invoices as any;
  assert.equal(tool.type, "ixp");
  assert.deepEqual(tool.properties, { projectName: "ixp_trial_invoices", versionTag: "staging" });
  const esc = result!.resources.Validation as any;
  assert.equal(esc.escalationType, 1);
  assert.deepEqual(esc.vsEscalationProperties, { ixpToolId: "ixp_trial_invoices", storageBucketName: "B", storageBucketFolderPath: "solution_folder" });
  assert.deepEqual(esc.channels[0].recipients, [{ type: 3, value: "a@example.com" }]);
  const bad = generate(ir({ tools: [{ ixp: "p", tag: "prod" as any }], escalations: [{ validate: "nope", bucket: "B", bucketFolder: "Shared" }] }), BASE).problems.map(p => p.code).sort();
  assert.deepEqual(bad, ["BAD_TAG", "UNKNOWN_IXP_TOOL"]);
});

test("古い RPA のプロセスの .NET の引数を JSON Schema にする", async () => {
  const { dotnetArgsToSchema } = await import("./gen.ts");
  const s = dotnetArgsToSchema([
    { name: "in_Name", type: "System.String, System.Private.CoreLib, Version=8.0.0.0, Culture=neutral, PublicKeyToken=7cec85d7bea7798e", required: true },
    { name: "in_Count", type: "System.Int32, System.Private.CoreLib" },
    { name: "in_Ok", type: "System.Boolean, mscorlib" },
    { name: "in_Tags", type: "System.String[], System.Private.CoreLib" },
    { name: "in_At", type: "System.DateTime, System.Private.CoreLib" },
    { name: "in_Table", type: "System.Data.DataTable, System.Data" },
  ]);
  assert.deepEqual(s, { type: "object", required: ["in_Name"], properties: {
    in_Name: { type: "string" }, in_Count: { type: "number" }, in_Ok: { type: "boolean" },
    in_Tags: { type: "array", items: { type: "string" } }, in_At: { type: "string", format: "date-time" }, in_Table: { type: "string" },
  } });
});

test("combos：文書にある使えない組み合わせを止め、注意を出す（AUT-1191）", () => {
  const codes = (r: { errors: { code: string }[]; warnings: { code: string }[] }) => ({ e: r.errors.map((x) => x.code), w: r.warnings.map((x) => x.code) });
  const web = { integration: "uipath-uipath-airdk", activity: "v2::webSearch" } as const;
  // Gemini × Integration Service の道具
  assert.deepEqual(codes(combos(ir({ model: "gemini-2.5-flash", tools: [web] }))).e, ["GEMINI_IS_TOOL"]);
  assert.deepEqual(codes(combos(ir({ model: "gpt-5.4", tools: [web] }))).e, []);
  // flow の中：MCP・IXP・Web Search
  assert.deepEqual(codes(combos(ir({ tools: [{ mcp: "m" }, { ixp: "p", tag: "live" }, web, { builtin: "create-file" }] }), { inline: true })).e, ["INLINE_UNSUPPORTED", "INLINE_UNSUPPORTED", "INLINE_UNSUPPORTED"]);
  assert.deepEqual(codes(combos(ir({ tools: [{ mcp: "m" }] }))).e, []);
  // ファイルの入力を処理できる道具が無い
  const fileIr = (tools: AgentIR["tools"], model?: string) => ir({ model, user: "{{input.doc}}", input: { doc: "file" }, tools });
  assert.deepEqual(codes(combos(fileIr([{ mcp: "m" }]))).w, ["NO_FILE_TOOL"]);
  assert.deepEqual(codes(combos(fileIr([{ builtin: "analyze-attachments" }]))).w, []);
  assert.deepEqual(codes(combos(fileIr([{ builtin: "analyze-attachments" }], "gemini-2.5-pro"))).w, ["GEMINI_FILES"]);
  // user で参照しない入力
  assert.deepEqual(codes(combos(ir({ input: { text: "string", extra: "string" } }))).w, ["UNUSED_INPUT"]);
  assert.deepEqual(codes(combos(ir({ conversational: true, user: undefined, input: { extra: "string" } }))).w, []);
  // generate は errors で止め、warnings を返す
  assert.equal(generate(ir({ model: "gemini-2.5-flash", tools: [web] }), BASE, ALL).problems[0].code, "GEMINI_IS_TOOL");
});

test("受け手：メールのほかに、利用者・グループの GUID、グループの名前、アセット、入力の引数を書ける（AUT-1189）", async () => {
  const { recipientResource, recipientIR } = await import("./gen.ts");
  const all = ["a@example.com", { userId: "u-1" }, { groupId: "g-1" }, { assetEmail: "ApproverEmail", folder: "Shared" }, { group: "Approvers" }, { assetGroup: "ApproverGroup", folder: "Shared/T" }, { argEmail: "approver" }, { argGroup: "team.group" }] as const;
  const res = all.map((r) => recipientResource(r as any));
  assert.deepEqual(res.map((r) => r!.type), [3, 1, 2, 4, 5, 6, 7, 8]);
  // アセットは value ではなく assetName と folderPath、入力の引数は argumentName（スキルの guardrails.md）
  assert.deepEqual(res[3], { type: 4, assetName: "ApproverEmail", folderPath: "Shared" });
  assert.deepEqual(res[6], { type: 7, argumentName: "approver" });
  assert.equal(recipientResource({ assetEmail: "x" } as any), undefined); // folder が要る
  assert.deepEqual(res.map((r) => recipientIR(r!)), all);
  assert.equal(recipientResource({ team: "x" } as any), undefined);
  assert.equal(recipientIR({ type: 12, value: "x" }), undefined);
});

test("受け手：Workload（9）・Round Robin（10）・LLM inferred（11）は Studio Web の書き出しと同じ形（AUT-1189）", async () => {
  const { recipientResource, recipientIR, LLM_RECIPIENT_HINT } = await import("./gen.ts");
  const g = "ce684f6f-5af3-4e43-8516-1adad6e98fc9";
  assert.deepEqual(recipientResource({ workload: g, name: "Everyone" }), { type: 9, value: g, displayName: "Everyone" });
  assert.deepEqual(recipientResource({ roundRobin: g }), { type: 10, value: g });
  assert.deepEqual(recipientResource({ llm: "承認者のメール" }), { type: 11, value: "" });
  assert.deepEqual(recipientIR({ type: 9, value: g, displayName: "Everyone" }), { workload: g, name: "Everyone" });
  assert.deepEqual(recipientIR({ type: 10, value: g }), { roundRobin: g });
  assert.deepEqual(recipientIR({ type: 11, value: "" }), { llm: LLM_RECIPIENT_HINT });
  assert.equal(recipientIR({ type: 9, value: "" }), undefined);
});

test("受け手：Workload・Round Robin・LLM はほかの受け手と並べられない（AUT-1189）", () => {
  const esc = { app: "SimpleApprovalApp", name: "Approval", recipients: [{ llm: "x" }, "a@example.com"] };
  const r = generate(ir({ escalations: [esc] } as any), BASE, ALL);
  assert.ok(r.problems.some((p) => p.code === "SOLO_RECIPIENT"));
});

test("harness：advanced は settings.mode に入り、ガードレールと一緒なら止める（AUT-1190）", () => {
  const r = generate(ir({ harness: "advanced" }), BASE, ALL);
  assert.equal((r.result!.agent.settings as any).mode, "advanced");
  assert.equal((generate(ir(), BASE, ALL).result!.agent.settings as any).mode, "standard");
  assert.equal(generate(ir({ harness: "advanced", guardrails: [{ promptInjection: 0.5 } as any] }), BASE, ALL).problems[0].code, "ADVANCED_GUARDRAILS");
  assert.equal(generate(ir({ harness: "turbo" as any }), BASE, ALL).problems[0].code, "BAD_HARNESS");
});

test("文書の決まり：Data Fabric は 5 表まで、会話型の Prompt injection、古い RPA の引数の型（AUT-1201）", async () => {
  const { unsupportedDotnetArgs } = await import("./gen.ts");
  const six = ["A", "B", "C", "D", "E", "F"];
  assert.ok(generate(ir({ contexts: [{ dataFabric: six, folder: "Shared" }] }), BASE, ALL).problems.some((p) => p.code === "TOO_MANY_ENTITIES"));
  assert.ok(generate({ name: "C", conversational: true, system: "s", guardrails: [{ promptInjection: 0.5 } as any] } as AgentIR, { ...BASE, metadata: { ...BASE.metadata, isConversational: true } }, ALL).problems.some((p) => p.code === "CONVERSATIONAL_PROMPT_INJECTION"));
  assert.deepEqual(unsupportedDotnetArgs([
    { name: "a", type: "System.String, System.Private.CoreLib" },
    { name: "b", type: "System.Int32[], System.Private.CoreLib" },
    { name: "c", type: "System.DateTime, System.Private.CoreLib" },
    { name: "d", type: "System.Data.DataTable, System.Data.Common" },
  ]), ["c（System.DateTime）", "d（System.Data.DataTable）"]);
});

test("ガードレールの省略形：IP 保護・User prompt attacks・LLM as Judge と log の重さを書けて、to-ir で戻る（AUT-1201 の 7）", () => {
  const gs = [
    { ip: ["Text", "Code"], action: "log", severity: "Error" },
    { userPromptAttacks: true },
    { judge: "個人の悪口を言わない", model: "gpt-5.4-mini-2026-03-17", positive: ["丁寧な返事"], threshold: 4, scopes: ["Tool"], tools: ["Probe"] },
  ] as any[];
  const r = generate(ir({ guardrails: gs }), BASE, ALL);
  assert.deepEqual(r.problems, []);
  const out = r.result!.agent.guardrails as any[];
  assert.deepEqual(out.map((g) => g.validatorType), ["intellectual_property", "user_prompt_attacks", "llm_as_judge"]);
  assert.deepEqual(out[0].action, { $actionType: "log", severityLevel: "Error" });
  assert.deepEqual(out[1].selector, { scopes: ["Llm"] });
  assert.deepEqual(out[2].selector, { scopes: ["Tool"], matchNames: ["Probe"] });
  const proj = scaffold();
  try {
    writeFileSync(join(proj, "agent.json"), JSON.stringify({ ...r.result!.agent }));
    const back = toIR(proj).guardrails as any[];
    assert.deepEqual(back, [
      { ip: ["Text", "Code"], scopes: ["Agent"], action: "log", severity: "Error" },
      { userPromptAttacks: true, action: "block" },
      { judge: "個人の悪口を言わない", model: "gpt-5.4-mini-2026-03-17", scopes: ["Tool"], action: "block", positive: ["丁寧な返事"], threshold: 4, tools: ["Probe"] },
    ]);
  } finally { rmSync(proj, { recursive: true, force: true }); }
  assert.equal(generate(ir({ guardrails: [{ judge: "x".repeat(4001), model: "m" } as any] }), BASE, ALL).problems[0].code, "TOO_LONG");
});

test("道具ごとのカスタムガードレール：規則を書けて、to-ir で戻る。無い道具・比べ方は誤り（AUT-1201 の 8）", () => {
  const tools = [{ process: "Probe", folder: "Shared" }] as any;
  const g = { tool: "Probe", rules: [{ word: "contains", value: "CONFIDENTIAL" }, { number: "greaterThan", value: 100, fields: [{ path: "total", source: "output" }] }, { always: "input" }], action: "log", severity: "Info" };
  const r = generate(ir({ tools, guardrails: [g as any] }), BASE, ALL);
  assert.deepEqual(r.problems, []);
  const out = (r.result!.agent.guardrails as any[])[0];
  assert.equal(out.$guardrailType, "custom");
  assert.deepEqual(out.selector, { scopes: ["Tool"], matchNames: ["Probe"] });
  assert.deepEqual(out.rules, [
    { $ruleType: "word", fieldSelector: { $selectorType: "all" }, operator: "contains", value: "CONFIDENTIAL" },
    { $ruleType: "number", fieldSelector: { $selectorType: "specific", fields: [{ path: "total", source: "output" }] }, operator: "greaterThan", value: 100 },
    { $ruleType: "always", applyTo: "input" },
  ]);
  const proj = scaffold();
  try {
    writeFileSync(join(proj, "agent.json"), JSON.stringify(r.result!.agent));
    assert.deepEqual(toIR(proj).guardrails, [g]);
  } finally { rmSync(proj, { recursive: true, force: true }); }
  const codes = (x: any) => generate(ir({ tools, guardrails: [x] }), BASE, ALL).problems.map((p) => p.code);
  assert.deepEqual(codes({ tool: "Nope", rules: [{ always: "input" }] }), ["UNKNOWN_TOOL"]);
  assert.deepEqual(codes({ tool: "Probe", rules: [{ word: "like", value: "x" }] }), ["BAD_OPERATOR"]);
});

test("評価器の省略形：種類と検査（AUT-1201 の 19）", async () => {
  const { EVALUATOR_KIND, evaluatorFile } = await import("./gen.ts");
  // Studio Web の Add evaluator で作って書き出した type・category
  assert.deepEqual(Object.fromEntries(Object.entries(EVALUATOR_KIND).map(([k, v]) => [k, [v.type, v.category]])), { exact: [1, 0], json: [6, 0], semantic: [5, 1], trajectory: [7, 3] });
  assert.equal(evaluatorFile("Answer Judge"), "evaluator-answer-judge.json");
  const codes = (evaluators: any) => generate(ir({ evaluators } as any), BASE, ALL).problems.map((p) => p.code);
  assert.deepEqual(codes([{ name: "A", kind: "exact" }, { name: "B", kind: "semantic", prompt: "x {{ActualOutput}}" }]), []);
  assert.deepEqual(codes([{ name: "A", kind: "exact" }, { name: "A", kind: "json" }]), ["BAD_EVALUATOR"]);
  assert.deepEqual(codes([{ name: "A", kind: "fuzzy" }]), ["BAD_EVALUATOR"]);
  assert.deepEqual(codes([{ name: "A", kind: "exact", prompt: "x" }]), ["BAD_EVALUATOR"]);
  assert.deepEqual(codes([{ name: "Default Evaluator", kind: "exact" }]), ["BAD_EVALUATOR"]);
});

test("Client-side tool と confirm（会話型だけ。AUT-1201 の 17）", () => {
  const cs = { clientSide: "get_location", description: "d", input: { type: "object", properties: {} }, output: { type: "object", properties: { city: { type: "string" } } }, confirm: true };
  const conv = { name: "C", conversational: true, system: "係です" };
  const r = generate({ ...conv, tools: [cs] } as any, CONV_BASE, ALL);
  assert.deepEqual(r.problems, []);
  const res: any = r.result!.resources.get_location;
  assert.equal(res.type, "clientSide");
  assert.equal(res.location, "solution");
  assert.deepEqual(res.properties, { folderPath: "solution_folder", requireConversationalConfirmation: true });
  const codes = (x: any) => generate(ir(x), BASE, ALL).problems.map((p) => p.code).sort();
  assert.deepEqual(codes({ tools: [cs] }), ["CLIENT_SIDE_NOT_CONVERSATIONAL", "CONFIRM_NOT_CONVERSATIONAL"]);
  assert.deepEqual(generate({ ...conv, tools: [{ ...cs, output: undefined }] } as any, CONV_BASE, ALL).problems.map((p) => p.code), ["CLIENT_SIDE_SCHEMA"]);
});

test("function の道具：ソリューションの中の関数の入口と key を使い、to-ir で戻す（AUT-1201 の 16）", () => {
  const sol = mkdtempSync(join(tmpdir(), "fn-"));
  try {
    writeFileSync(join(sol, "S.uipx"), "{}");
    mkdirSync(join(sol, "Function"));
    writeFileSync(join(sol, "Function", "entry-points.json"), JSON.stringify({ entryPoints: [{ name: "main", input: { type: "object", properties: { x: { type: "integer" } } }, output: { type: "object", properties: { result: { type: "integer" } } } }] }));
    mkdirSync(join(sol, "resources", "solution_folder", "process", "function"), { recursive: true });
    writeFileSync(join(sol, "resources", "solution_folder", "process", "function", "Function.json"), JSON.stringify({ resource: { key: "k-1" } }));
    const agent = join(sol, "Agent");
    mkdirSync(agent);
    const r = generate(ir({ tools: [{ function: "Function" }] } as any), BASE, { ...ALL, project: agent });
    assert.deepEqual(r.problems, []);
    const res: any = r.result!.resources.Function;
    assert.equal(res.type, "function");
    assert.equal(res.location, "solution");
    assert.equal(res.referenceKey, "k-1");
    assert.deepEqual(res.properties, { folderPath: "solution_folder", processName: "Function" });
    assert.deepEqual(res.inputSchema.properties, { x: { type: "integer" } });
    assert.deepEqual(generate(ir({ tools: [{ function: "Nope" }] } as any), BASE, { ...ALL, project: agent }).problems.map((p) => p.code), ["FUNCTION_NOT_FOUND"]);
  } finally {
    rmSync(sol, { recursive: true, force: true });
  }
});

test("エスカレーションのメモリ：properties.memory の形と検査（AUT-1201 の 18）", () => {
  const esc = (memory: any) => ({ app: "SimpleApprovalApp", name: "Approval", recipients: ["a@example.com"], memory });
  const mem = [{ space: "M", folder: "Shared" }];
  const r = generate(ir({ memory: mem, escalations: [esc({ fields: ["Content"], match: "all" })] } as any), BASE, ALL);
  assert.deepEqual(r.problems, []);
  const m: any = (r.result!.resources.Approval as any).properties.memory;
  assert.deepEqual({ ...m, fieldSettings: m.fieldSettings.map((f: any) => ({ name: f.name, weight: f.weight })) },
    { isEnabled: true, threshold: 0.8, searchMode: "hybrid", fieldMatching: "and", fieldSettings: [{ name: "Content", weight: 1 }] });
  const two: any = (generate(ir({ memory: mem, escalations: [esc({ fields: ["Content", "Comment"] })] } as any), BASE, ALL).result!.resources.Approval as any).properties.memory;
  assert.deepEqual(two.fieldSettings.map((f: any) => f.weight), [0.5, 0.5]);
  assert.equal(two.fieldMatching, "or");
  const codes = (x: any) => generate(ir(x), BASE, ALL).problems.map((p) => p.code);
  assert.deepEqual(codes({ escalations: [esc({ fields: ["Content"] })] }), ["ESC_MEMORY"]); // memory space が無い
  assert.deepEqual(codes({ memory: mem, escalations: [esc({ fields: ["Nope"] })] }), ["ESC_MEMORY"]);
  assert.deepEqual(codes({ memory: mem, escalations: [esc({ fields: { Content: 0.3, Comment: 0.3 } })] }), ["ESC_MEMORY"]);
});

test("道具のカスタムガードレールの Filter（AUT-1201 の 8）", () => {
  const web = { builtin: "create-file", name: "Create File" };
  const g = { tool: "Create File", rules: [{ always: "inputAndOutput" }], action: "filter", filter: [{ path: "content", source: "input" }] };
  const r = generate(ir({ tools: [web], guardrails: [g] } as any), BASE, ALL);
  assert.deepEqual(r.problems, []);
  assert.deepEqual((r.result!.agent as any).guardrails[0].action, { $actionType: "filter", fields: [{ path: "content", source: "input" }] });
  const codes = (x: any) => generate(ir({ tools: [web], guardrails: [x] } as any), BASE, ALL).problems.map((p) => p.code);
  assert.deepEqual(codes({ ...g, filter: [] }), ["MISSING"]);
  assert.deepEqual(codes({ ...g, action: "block" }), ["BAD_GUARDRAIL"]);
});

test("インデックスのコンテキストの query・prefix：Static / Argument / Dynamic（AUT-1201 の 13）", () => {
  const ctx = (x: any) => (generate(ir({ input: { text: "string" }, user: "{{input.text}}", contexts: [{ index: "Idx", folder: "Shared", ...x }] } as any), BASE, ALL).result!.resources.Idx as any).settings;
  assert.deepEqual(ctx({}).query.variant, "dynamic");
  assert.deepEqual(ctx({ query: "rules", prefix: "policies/**" }).query, { variant: "static", description: "Query for retrieval", value: "rules" });
  assert.deepEqual(ctx({ query: "rules", prefix: "policies/**" }).folderPathPrefix, { variant: "static", value: "policies/**" });
  assert.deepEqual(ctx({ query: { arg: "text" }, prefix: { arg: "text" } }).folderPathPrefix, { variant: "argument", value: "{{text}}" });
  assert.deepEqual(generate(ir({ input: { text: "string" }, user: "{{input.text}}", contexts: [{ index: "Idx", folder: "Shared", query: { arg: "nope" } }] } as any), BASE, ALL).problems.map((p) => p.code), ["UNKNOWN_INPUT"]);
});
