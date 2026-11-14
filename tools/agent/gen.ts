// ローコードのエージェント（Agent Builder / Studio Web の「Agent」。agent.json）の生成器。
// AI は小さな IR を書き、生成器がエージェントのプロジェクトを作る。手で書くと落ちる所をここで決まった形にする：
//   - プロンプトの contentTokens（{{input.x}} は variable、@{tools.X} などは expression、ほかは simpleText）を content から作る
//   - {{input.x}} が入力に無い、@{tools.X} が道具に無い、を生成の前に止める
//   - 入力・出力の JSON Schema（required の並び、ファイルは job-attachment の決まった定義）
//   - 道具（resources/<名前>/resource.json）。デプロイ済みのプロセス・API ワークフロー・エージェントは
//     uip solution resources list / get で探して、引数の形をそのまま写す（推測で書かない）
//   - ガードレール（$guardrailType などの判別子）、評価のケース
//   - id は前に生成したものを引き継ぐ（作り直しても Studio Web から見て同じもの）
// 形の出典：uipath-agents スキルの references/lowcode/*.md と、uip agent init / eval add が書く形。knowledge/agents.md
//
// 使い方:
//   node tools/agent/gen.ts <ir.json> --project <エージェントのフォルダ> [--profile trial]
//     フォルダが無ければ uip agent init で作る（ソリューションの中ならそこに登録、外なら <名前>Solution/<名前> を作る）
//     書いたあと uip agent refresh → validate、道具があれば uip solution resources refresh まで流す
//   node tools/agent/gen.ts <ir.json> --print     # agent.json を表示するだけ（CLI を呼ばない。デプロイ済みの道具は使えない）
// 終了コード: 0 = OK、1 = IR の誤りか CLI の失敗、2 = 使い方の間違い

import { spawnSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { basename, dirname, join, resolve } from "node:path";

// ---------- IR ----------

/** 入力・出力の 1 項目。"string" などの省略形、"file"（job-attachment）、JSON Schema そのもの */
export type Field = string | ({ type?: string; description?: string; required?: boolean; enum?: unknown[]; items?: unknown; properties?: unknown } & Record<string, unknown>);

export type Tool =
  | { process: string; folder?: string; name?: string; description?: string; examples?: unknown[] }
  | { builtin: "analyze-attachments"; name?: string; description?: string }
  | { raw: Record<string, unknown> };

export type Guardrail =
  | { pii: string[]; threshold?: number; scopes?: string[]; tools?: string[]; action?: "block" | "log"; name?: string; reason?: string }
  | { harmful: string[]; threshold?: number; scopes?: string[]; action?: "block" | "log"; name?: string; reason?: string }
  | { promptInjection: number; action?: "block" | "log"; name?: string; reason?: string }
  | { raw: Record<string, unknown> };

export type EvalCase = {
  name: string;
  inputs: Record<string, unknown>;
  expected?: Record<string, unknown>;
  behavior?: string;
  simulateTools?: boolean;
  simulationInstructions?: string;
};

export type AgentIR = {
  name: string;
  conversational?: boolean;
  model?: string;
  temperature?: number;
  maxTokens?: number;
  maxIterations?: number;
  description?: string;
  system: string;
  user?: string;
  input?: Record<string, Field>;
  output?: Record<string, Field>;
  tools?: Tool[];
  /** 道具以外のリソース（コンテキスト・エスカレーション・MCP）。resource.json をそのまま書く */
  resources?: Record<string, unknown>[];
  guardrails?: Guardrail[];
  evals?: EvalCase[];
  /** 既定のほかの評価セット・評価器（evals/ からの相対パス → 中身）。to-ir.ts がテンプレートなどから取り込むもの */
  evalFiles?: Record<string, unknown>;
};

export type Problem = { path: string; code: string; message: string };

/** デプロイ済みのプロセスを探す関数（CLI を呼ぶ。テストでは差し替える） */
export type ProcessLookup = (name: string, folder: string | undefined) =>
  | { key: string; name: string; type: string; folder: string; inputSchema: unknown; outputSchema: unknown }
  | { error: string };

const JOB_ATTACHMENT = {
  type: "object",
  properties: {
    ID: { type: "string", description: "Orchestrator attachment key" },
    FullName: { type: "string", description: "File name" },
    MimeType: { type: "string", description: "MIME type, e.g. \"application/pdf\", \"image/png\"" },
    Metadata: { type: "object", description: "Dictionary<string, string> of metadata", additionalProperties: { type: "string" } },
  },
  required: ["ID"],
  "x-uipath-resource-kind": "JobAttachment",
};

const SIMPLE = new Set(["string", "number", "integer", "boolean", "object", "array"]);

// ---------- 部品 ----------

/** content を contentTokens に分ける。{{…}} は variable、@{…} は expression、ほかは simpleText */
export function tokenize(content: string): { type: string; rawString: string }[] {
  const out: { type: string; rawString: string }[] = [];
  const re = /\{\{\s*([^}]+?)\s*\}\}|@\{\s*([^}]+?)\s*\}/g;
  let last = 0;
  for (let m: RegExpExecArray | null; (m = re.exec(content)); ) {
    if (m.index > last) out.push({ type: "simpleText", rawString: content.slice(last, m.index) });
    out.push(m[1] !== undefined ? { type: "variable", rawString: m[1] } : { type: "expression", rawString: m[2] });
    last = re.lastIndex;
  }
  if (last < content.length) out.push({ type: "simpleText", rawString: content.slice(last) });
  return out;
}

/** 項目の省略形を JSON Schema にする。required は呼ぶ側で集める */
function fieldSchema(f: Field, defs: Record<string, unknown>, p: string, probs: Problem[]): Record<string, unknown> {
  if (typeof f === "string") {
    if (f === "file") { defs["job-attachment"] = JOB_ATTACHMENT; return { $ref: "#/definitions/job-attachment" }; }
    if (f === "file[]") { defs["job-attachment"] = JOB_ATTACHMENT; return { type: "array", items: { $ref: "#/definitions/job-attachment" } }; }
    if (!SIMPLE.has(f)) probs.push({ path: p, code: "BAD_TYPE", message: `型 "${f}" は使えない（string / number / integer / boolean / object / array / file / file[]）` });
    return { type: f };
  }
  const { required: _r, ...rest } = f;
  if (rest.type === "file") {
    defs["job-attachment"] = JOB_ATTACHMENT;
    const { type: _t, ...more } = rest;
    return { $ref: "#/definitions/job-attachment", ...more };
  }
  if (rest.type !== undefined && !SIMPLE.has(String(rest.type))) probs.push({ path: p, code: "BAD_TYPE", message: `型 "${rest.type}" は使えない` });
  return rest;
}

function schemaOf(fields: Record<string, Field> | undefined, p: string, probs: Problem[], withRequired: boolean): Record<string, unknown> {
  const properties: Record<string, unknown> = {};
  const required: string[] = [];
  const defs: Record<string, unknown> = {};
  for (const [k, f] of Object.entries(fields ?? {})) {
    if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(k)) probs.push({ path: `${p}.${k}`, code: "BAD_NAME", message: "項目名は英数字と _ だけ（{{input.名前}} で参照するため）" });
    properties[k] = fieldSchema(f, defs, `${p}.${k}`, probs);
    // 入力は既定で必須。"required": false で外す。出力は required を書いたものだけ
    const req = typeof f === "object" && f !== null ? f.required : undefined;
    if (withRequired ? req !== false : req === true) required.push(k);
  }
  const s: Record<string, unknown> = { type: "object", properties };
  if (required.length) s.required = required;
  if (Object.keys(defs).length) s.definitions = defs;
  return s;
}

function readJson(path: string): any {
  return JSON.parse(readFileSync(path, "utf8").replace(/^﻿/, ""));
}

function writeJson(path: string, v: unknown) {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, JSON.stringify(v, null, 2) + "\n");
}

/** 前に生成した resource.json の id（作り直しても同じ id にする） */
function oldId(dir: string, name: string): string | undefined {
  const f = join(dir, "resources", name, "resource.json");
  if (!existsSync(f)) return undefined;
  try { return readJson(f).id; } catch { return undefined; }
}

// ---------- 道具 ----------

function toolResource(t: Tool, i: number, lookup: ProcessLookup | undefined, project: string | undefined, probs: Problem[]): Record<string, unknown> | undefined {
  const p = `tools[${i}]`;
  if ("raw" in t) return t.raw;
  if ("builtin" in t) {
    if (t.builtin !== "analyze-attachments") { probs.push({ path: p, code: "BAD_BUILTIN", message: `組み込みの道具 "${t.builtin}" は無い（analyze-attachments だけ）` }); return undefined; }
    const name = t.name ?? "AnalyzeFiles";
    return {
      $resourceType: "tool",
      id: (project && oldId(project, name)) ?? randomUUID(),
      name,
      description: t.description ?? "Analyze one or more files with an LLM to extract, synthesize, or answer queries about their content.",
      type: "internal", // location は書かない（"solution" にすると validate が folderPath を求める）
      inputSchema: {
        type: "object",
        properties: {
          attachments: { type: "array", items: { $ref: "#/definitions/job-attachment" }, description: "Array of files, documents, images, or other attachments to process" },
          analysisTask: { type: "string", description: "The task, question, or instruction for processing the files (e.g., 'summarize this document', 'extract key points', 'what is in this image')" },
        },
        required: ["attachments", "analysisTask"],
        definitions: { "job-attachment": JOB_ATTACHMENT },
      },
      outputSchema: { type: "object", properties: { analysis: { type: "string", description: "Analysis result of the attachments (analysis, summary, extracted information, etc.)" } }, required: ["analysis"] },
      settings: {},
      guardrail: { policies: [] },
      argumentProperties: {},
      properties: { toolType: "analyze-attachments" },
    };
  }
  if (!lookup) { probs.push({ path: p, code: "NEED_TENANT", message: "デプロイ済みのプロセスを道具にするには --project で生成する（--print では探せない）" }); return undefined; }
  const found = lookup(t.process, t.folder);
  if ("error" in found) { probs.push({ path: p, code: "PROCESS_NOT_FOUND", message: found.error }); return undefined; }
  const name = t.name ?? found.name;
  if (!/^[A-Za-z][A-Za-z0-9_ -]*$/.test(name)) probs.push({ path: p, code: "BAD_NAME", message: `道具の名前 "${name}" は英数字で始める（name で付け直す）` });
  return {
    $resourceType: "tool",
    id: (project && oldId(project, name)) ?? randomUUID(),
    name,
    description: t.description ?? `Calls the ${found.type} "${found.name}"`,
    location: found.folder === "solution_folder" ? "solution" : "external",
    type: found.type,
    inputSchema: found.inputSchema ?? { type: "object", properties: {} },
    outputSchema: found.outputSchema ?? { type: "object", properties: {} },
    settings: {},
    guardrail: { policies: [] },
    properties: { processName: found.name, folderPath: found.folder, exampleCalls: t.examples ?? [] },
    referenceKey: found.key.toLowerCase(),
    isEnabled: true,
    argumentProperties: {},
  };
}

// ---------- ガードレール ----------

function guardrail(g: Guardrail, i: number, old: Record<string, string>, probs: Problem[]): Record<string, unknown> | undefined {
  if ("raw" in g) return g.raw;
  const action = (g.action ?? "block") === "block"
    ? { $actionType: "block", reason: g.reason ?? "Guardrail violation — execution blocked." }
    : { $actionType: "log", severityLevel: "Warning" };
  const base = (name: string, description: string, validatorType: string, validatorParameters: unknown[], selector: Record<string, unknown>) =>
    ({ $guardrailType: "builtInValidator", id: old[name] ?? randomUUID(), name, description, validatorType, validatorParameters, action, enabledForEvals: true, selector });
  if ("pii" in g) {
    const th = g.threshold ?? 0.8;
    const scopes = g.scopes ?? ["Agent"];
    const selector: Record<string, unknown> = { scopes };
    if (g.tools?.length) selector.matchNames = g.tools;
    return base(g.name ?? "PII detection guardrail", "Detects personally identifiable information", "pii_detection", [
      { $parameterType: "enum-list", id: "entities", value: g.pii },
      { $parameterType: "map-enum", id: "entityThresholds", value: Object.fromEntries(g.pii.map(e => [e, th])) },
    ], selector);
  }
  if ("harmful" in g) {
    const th = g.threshold ?? 2;
    return base(g.name ?? "Harmful content guardrail", "Detects harmful content", "harmful_content", [
      { $parameterType: "enum-list", id: "harmfulContentEntities", value: g.harmful },
      { $parameterType: "map-enum", id: "harmfulContentEntityThresholds", value: Object.fromEntries(g.harmful.map(e => [e, th])) },
    ], { scopes: g.scopes ?? ["Agent"] });
  }
  if ("promptInjection" in g) {
    return base(g.name ?? "Prompt injection guardrail", "Detects prompt injection and jailbreak attempts in LLM calls", "prompt_injection",
      [{ $parameterType: "number", id: "threshold", value: g.promptInjection }], { scopes: ["Llm"] });
  }
  probs.push({ path: `guardrails[${i}]`, code: "BAD_GUARDRAIL", message: "pii / harmful / promptInjection / raw のどれかを書く" });
  return undefined;
}

// ---------- 本体 ----------

export type Generated = { agent: Record<string, unknown>; resources: Record<string, Record<string, unknown>>; evals: EvalCase[] };

/** IR からエージェントの中身を作る。base は既にある agent.json（init が作ったもの） */
export function generate(ir: AgentIR, base: Record<string, any>, opts: { lookup?: ProcessLookup; project?: string } = {}): { result?: Generated; problems: Problem[] } {
  const probs: Problem[] = [];
  if (!ir.name) probs.push({ path: "name", code: "MISSING", message: "name が要る" });
  if (!ir.system) probs.push({ path: "system", code: "MISSING", message: "system（システムプロンプト）が要る" });
  const conv = ir.conversational === true;
  if (base.metadata && (base.metadata.isConversational === true) !== conv)
    probs.push({ path: "conversational", code: "VARIANT_MISMATCH", message: "既にあるプロジェクトと会話型かどうかが違う。会話型と自律型は作り直す（uip agent init [--conversational]）" });
  if (conv && ir.user) probs.push({ path: "user", code: "CONVERSATIONAL_USER", message: "会話型は user を書かない（会話の発言が毎回渡る）" });
  if (conv && ir.output && Object.keys(ir.output).length) probs.push({ path: "output", code: "CONVERSATIONAL_OUTPUT", message: "会話型は output を書かない" });
  if (!conv && !ir.user) probs.push({ path: "user", code: "MISSING", message: "自律型は user（{{input.名前}} を含むメッセージの型）が要る" });

  const inputSchema = schemaOf(ir.input, "input", probs, true);
  const outputSchema = conv ? { type: "object", properties: {} } : schemaOf(ir.output, "output", probs, false);

  // 道具とリソース
  const resources: Record<string, Record<string, unknown>> = {};
  (ir.tools ?? []).forEach((t, i) => {
    const r = toolResource(t, i, opts.lookup, opts.project, probs);
    if (!r) return;
    const n = String(r.name);
    if (resources[n]) probs.push({ path: `tools[${i}]`, code: "DUP_NAME", message: `名前 "${n}" が重なる` });
    resources[n] = r;
  });
  (ir.resources ?? []).forEach((r, i) => {
    const n = String(r.name ?? "");
    if (!n || !r.$resourceType) { probs.push({ path: `resources[${i}]`, code: "BAD_RESOURCE", message: "name と $resourceType が要る" }); return; }
    if (resources[n]) probs.push({ path: `resources[${i}]`, code: "DUP_NAME", message: `名前 "${n}" が重なる` });
    resources[n] = { ...r, id: r.id ?? (opts.project && oldId(opts.project, n)) ?? randomUUID() };
  });

  // プロンプトの参照を確かめる
  const family: Record<string, string> = { tool: "tools", context: "contexts", escalation: "escalations", mcp: "tools" };
  const known = new Set(Object.values(resources).map(r => `${family[String(r.$resourceType)] ?? "?"}.${r.name}`));
  const check = (text: string, p: string) => {
    for (const tk of tokenize(text)) {
      if (tk.type === "variable") {
        const m = /^input\.([A-Za-z_][A-Za-z0-9_]*)/.exec(tk.rawString);
        if (!m) probs.push({ path: p, code: "BAD_VARIABLE", message: `{{${tk.rawString}}} は {{input.名前}} の形で書く` });
        else if (!(inputSchema.properties as Record<string, unknown>)[m[1]]) probs.push({ path: p, code: "UNKNOWN_INPUT", message: `{{${tk.rawString}}} の "${m[1]}" が input に無い` });
      } else if (tk.type === "expression") {
        if (/^output\./.test(tk.rawString)) continue;
        if (!known.has(tk.rawString)) probs.push({ path: p, code: "UNKNOWN_RESOURCE", message: `@{${tk.rawString}} が無い（ある物: ${[...known].join(", ") || "なし"}）` });
      }
    }
  };
  check(ir.system ?? "", "system");
  if (ir.user) check(ir.user, "user");

  // ガードレール
  const oldG: Record<string, string> = Object.fromEntries((base.guardrails ?? []).map((g: any) => [g.name, g.id]));
  const guardrails = (ir.guardrails ?? []).map((g, i) => guardrail(g, i, oldG, probs)).filter(Boolean);
  const toolNames = new Set(Object.values(resources).filter(r => r.$resourceType === "tool").map(r => String(r.name)));
  (ir.guardrails ?? []).forEach((g, i) => {
    if ("pii" in g) for (const n of g.tools ?? []) if (!toolNames.has(n)) probs.push({ path: `guardrails[${i}].tools`, code: "UNKNOWN_TOOL", message: `道具 "${n}" が無い` });
  });

  // 評価のケース：入力の名前を確かめる
  (ir.evals ?? []).forEach((e, i) => {
    for (const k of Object.keys(e.inputs ?? {})) if (!(inputSchema.properties as Record<string, unknown>)[k]) probs.push({ path: `evals[${i}].inputs.${k}`, code: "UNKNOWN_INPUT", message: `"${k}" が input に無い` });
    for (const k of Object.keys(e.expected ?? {})) if (!conv && !(outputSchema.properties as Record<string, unknown>)[k]) probs.push({ path: `evals[${i}].expected.${k}`, code: "UNKNOWN_OUTPUT", message: `"${k}" が output に無い` });
  });

  for (const rel of Object.keys(ir.evalFiles ?? {}))
    if (!/^(eval-sets|evaluators)\/[^/\\]+\.json$/.test(rel)) probs.push({ path: `evalFiles.${rel}`, code: "BAD_EVAL_FILE", message: "eval-sets/<名前>.json か evaluators/<名前>.json" });

  if (probs.length) return { problems: probs };

  const s = base.settings ?? {};
  const agent: Record<string, unknown> = {
    ...base,
    settings: {
      ...s,
      model: ir.model ?? s.model,
      maxTokens: ir.maxTokens ?? s.maxTokens,
      temperature: ir.temperature ?? s.temperature ?? 0,
      engine: s.engine ?? (conv ? "conversational-v1" : "basic-v2"),
      maxIterations: ir.maxIterations ?? s.maxIterations,
      mode: s.mode ?? "standard",
    },
    inputSchema,
    outputSchema,
    messages: [
      { role: "system", content: ir.system, contentTokens: tokenize(ir.system) },
      { role: "user", content: conv ? "" : ir.user, contentTokens: conv ? [] : tokenize(ir.user!) },
    ],
  };
  if (guardrails.length) agent.guardrails = guardrails; else delete agent.guardrails;
  return { result: { agent, resources, evals: ir.evals ?? [] }, problems: [] };
}

// ---------- CLI を呼ぶ ----------

function uip(args: string[], profile: string | undefined, cwd?: string): { ok: boolean; json: any; text: string } {
  const full = [...args, "--output", "json", ...(profile ? ["--profile", profile] : [])];
  const r = spawnSync("uip", full, { encoding: "utf8", shell: process.platform === "win32", cwd, maxBuffer: 64 * 1024 * 1024 });
  const text = (r.stdout ?? "") + (r.stderr ?? "");
  // 進み具合の行（{"Message":…}）が先に出ることがあるので、最後の JSON の塊を読む
  const start = (r.stdout ?? "").search(/^\{\s*$/m);
  let json: any;
  try { json = JSON.parse(start >= 0 ? r.stdout.slice(start) : r.stdout); } catch { /* 読めない */ }
  return { ok: r.status === 0 && json?.Result === "Success", json, text };
}

function q(s: string) { return /[\s"&|<>^]/.test(s) ? `"${s.replace(/"/g, '\\"')}"` : s; }

export function cliLookup(profile: string | undefined, cwd: string): ProcessLookup {
  return (name, folder) => {
    const l = uip(["solution", "resources", "list", "--source", "remote", "--kind", "Process", "--search", q(name)], profile, cwd);
    if (!l.ok) return { error: `uip solution resources list が失敗した: ${l.text.slice(0, 300)}` };
    const rows = (l.json.Data as any[]).filter(r => r.Name === name && (!folder || r.Folder === folder));
    if (rows.length === 0) return { error: `デプロイ済みのプロセス "${name}"${folder ? `（${folder}）` : ""} が見つからない` };
    if (rows.length > 1) return { error: `"${name}" が複数のフォルダにある（${rows.map(r => r.Folder).join(", ")}）。folder を書く` };
    const row = rows[0];
    const g = uip(["solution", "resources", "get", row.Key], profile, cwd);
    if (!g.ok) return { error: `uip solution resources get が失敗した: ${g.text.slice(0, 300)}` };
    const spec = g.json.Data.Spec ?? g.json.Data.spec ?? {};
    const parse = (s: unknown) => (typeof s === "string" && s ? JSON.parse(s) : undefined);
    let inputSchema = parse(spec.InputArgumentsSchemaV2 ?? spec.inputArgumentsSchemaV2);
    let outputSchema = parse(spec.OutputArgumentsSchemaV2 ?? spec.outputArgumentsSchemaV2);
    if (!inputSchema && (spec.InputArgumentsSchema ?? spec.inputArgumentsSchema)) return { error: `"${name}" は RPA の .NET の引数。今は V2（API ワークフロー・エージェント・Maestro）だけ。raw で resource.json を書く` };
    for (const s of [inputSchema, outputSchema]) if (s) delete s.title;
    return { key: row.Key, name: row.Name, type: String(row.Type), folder: row.Folder, inputSchema, outputSchema };
  };
}

/** 評価のケースを既定の評価セットに書く（名前で突き合わせ、id は引き継ぐ） */
function writeEvals(project: string, cases: EvalCase[]) {
  const dir = join(project, "evals", "eval-sets");
  const files = existsSync(dir) ? readdirSync(dir).filter(f => f.endsWith(".json")) : [];
  const file = files.includes("evaluation-set-default.json") ? "evaluation-set-default.json" : files[0];
  if (!file) {
    if (!cases.length) return;
    throw new Error("evals/eval-sets に評価セットが無い（uip agent init が作るはず）");
  }
  const set = readJson(join(dir, file));
  const old = new Map<string, any>((set.evaluations ?? []).map((e: any) => [e.name, e]));
  const now = new Date().toISOString();
  set.evaluations = cases.map(c => {
    const o = old.get(c.name);
    return {
      id: o?.id ?? randomUUID(),
      name: c.name,
      inputs: c.inputs,
      expectedOutput: c.expected ?? {},
      simulationInstructions: c.simulationInstructions ?? "",
      expectedAgentBehavior: c.behavior ?? "",
      simulateInput: false,
      inputGenerationInstructions: "",
      simulateTools: c.simulateTools ?? false,
      evalSetId: set.id,
      createdAt: o?.createdAt ?? now,
      updatedAt: now,
      source: "manual",
    };
  });
  writeJson(join(dir, file), set);
}

/** 生成した中身をプロジェクトのフォルダに書く。resources/ と評価は IR が正本（IR に無いものは消す） */
export function writeProject(dir: string, ir: AgentIR, result: Generated) {
  writeJson(join(dir, "agent.json"), result.agent);
  // resources/ は IR が正本。IR に無いものは消す
  const resDir = join(dir, "resources");
  if (existsSync(resDir)) for (const d of readdirSync(resDir)) if (!result.resources[d]) rmSync(join(resDir, d), { recursive: true, force: true });
  for (const [n, r] of Object.entries(result.resources)) writeJson(join(resDir, n, "resource.json"), r);
  const up = join(dir, "project.uiproj");
  if (existsSync(up)) writeJson(up, { ...readJson(up), Name: ir.name, ...(ir.description !== undefined ? { Description: ir.description } : {}) });
  writeEvals(dir, result.evals);
  // 既定のほかの評価セット・評価器も IR が正本。init が作る既定のもの以外で IR に無いファイルは消す
  const keep = new Set(["eval-sets/evaluation-set-default.json", "evaluators/evaluator-default.json", "evaluators/evaluator-default-trajectory.json", ...Object.keys(ir.evalFiles ?? {})]);
  for (const sub of ["eval-sets", "evaluators"]) {
    const d = join(dir, "evals", sub);
    if (existsSync(d)) for (const f of readdirSync(d)) if (f.endsWith(".json") && !keep.has(`${sub}/${f}`)) rmSync(join(d, f));
  }
  for (const [rel, v] of Object.entries(ir.evalFiles ?? {})) {
    writeJson(join(dir, "evals", rel), v);
  }

}

/** ソリューションのフォルダ（.uipx がある所）を上にたどって探す */
export function findSolution(dir: string): string | undefined {
  for (let d = resolve(dir); ; d = dirname(d)) {
    if (existsSync(d) && readdirSync(d).some(f => f.endsWith(".uipx"))) return d;
    if (dirname(d) === d) return undefined;
  }
}

function main(argv: string[]): number {
  const args = argv.slice(2);
  const irPath = args.find(a => !a.startsWith("--") && args[args.indexOf(a) - 1] !== "--project" && args[args.indexOf(a) - 1] !== "--profile");
  const opt = (n: string) => { const i = args.indexOf(n); return i >= 0 ? args[i + 1] : undefined; };
  const project = opt("--project");
  const profile = opt("--profile");
  if (!irPath || (!project && !args.includes("--print"))) {
    console.error("使い方: node tools/agent/gen.ts <ir.json> --project <エージェントのフォルダ> [--profile <名前>] | --print");
    return 2;
  }
  const ir = readJson(irPath) as AgentIR;
  const report = (probs: Problem[]) => { for (const p of probs) console.error(`NG ${p.path}: [${p.code}] ${p.message}`); return 1; };

  if (!project) {
    const base = { version: "1.2.0", settings: {}, metadata: { storageVersion: "50.0.0", isConversational: ir.conversational === true, showProjectCreationExperience: false, targetRuntime: "pythonAgent" }, type: "lowCode", projectId: "<uip agent init が付ける>" };
    const { result, problems } = generate(ir, base);
    if (!result) return report(problems);
    console.log(JSON.stringify(result.agent, null, 2));
    return 0;
  }

  let dir = resolve(project);
  if (!existsSync(join(dir, "agent.json"))) {
    // 無ければ init。ソリューションの中ならそこに登録、外なら <名前>Solution/<名前> ができる
    const init = uip(["agent", "init", q(dir), ...(ir.conversational ? ["--conversational"] : []), ...(ir.model ? ["--model", q(ir.model)] : [])], profile);
    if (!init.ok) { console.error(`uip agent init が失敗した:\n${init.text}`); return 1; }
    dir = init.json.Data.Path;
    console.log(`作った: ${dir}`);
  }
  const solution = findSolution(dirname(dir));
  const base = readJson(join(dir, "agent.json"));
  const { result, problems } = generate(ir, base, { lookup: cliLookup(profile, solution ?? dir), project: dir });
  if (!result) return report(problems);

  writeProject(dir, ir, result);
  for (const e of result.evals)
    if (!e.expected || !Object.keys(e.expected).length)
      console.error(`注意 evals「${e.name}」: expected が無い。既定の評価器（出力の比較）はこのケースでエラーになる（振る舞いの評価器だけが点を付ける）`);

  for (const step of [["agent", "refresh", q(dir)], ["agent", "validate", q(dir)]]) {
    const r = uip(step, profile);
    if (!r.ok) { console.error(`uip ${step.slice(0, 2).join(" ")} が失敗した:\n${r.text}`); return 1; }
  }
  const needsSolution = Object.values(result.resources).some(r => r.type !== "internal");
  if (needsSolution && solution) {
    const r = uip(["solution", "resources", "refresh", "--solution-folder", q(solution)], profile);
    if (!r.ok) { console.error(`uip solution resources refresh が失敗した:\n${r.text}`); return 1; }
  }
  console.log(`OK ${basename(dir)}: agent.json と resources ${Object.keys(result.resources).length} 個、評価 ${result.evals.length} 件。refresh → validate 済み`);
  return 0;
}

if (process.argv[1] && resolve(process.argv[1]) === resolve(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1"))) process.exit(main(process.argv));
