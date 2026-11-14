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
  /** DeepRAG（書類を読んで出典つきでまとめる）。task は何をするか。fileExtension は pdf / txt */
  | { builtin: "deep-rag"; task: string; fileExtension?: string; citations?: boolean; name?: string; description?: string }
  /** Batch Transform（CSV の行ごとに LLM で列を足す） */
  | { builtin: "batch-transform"; task: string; columns: { name: string; description: string }[]; webSearch?: boolean; fileExtension?: string; name?: string; description?: string }
  /** Create File（ファイルを作って、ほかの道具に渡すか出力に返す） */
  | { builtin: "create-file"; name?: string; description?: string }
  /** AgentHub の MCP サーバー（slug）。tools で使う道具を絞る（書かなければ全部） */
  | { mcp: string; tools?: string[]; description?: string }
  /** Integration Service の活動。connection は接続の Id か名前（書かなければその connector の既定の接続）。values は固定の値 */
  | { integration: string; activity: string; connection?: string; name?: string; description?: string; values?: Record<string, unknown> }
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
  /** エージェントのメモリ（memory space。先に Studio Web か agents_ の画面で作る）。features/ は CLI（uip agent memory add）が書く */
  memory?: { space: string; folder: string; name?: string; threshold?: number; resultCount?: number; searchMode?: "hybrid" | "semantic"; fields?: Record<string, number>; fewShot?: boolean }[];
  /** 知識（コンテキスト）。インデックス（RAG）・Data Fabric の表・実行時の添付 */
  contexts?: Context[];
  /** 人に上げる（Action Center のタスク）。アプリは Workflow Action の種類（Studio Web の「RPA app」の Action App） */
  escalations?: Escalation[];
  /** 道具以外のリソース（コンテキスト・エスカレーション・MCP）。resource.json をそのまま書く */
  resources?: Record<string, unknown>[];
  guardrails?: Guardrail[];
  evals?: EvalCase[];
  /** 既定のほかの評価セット・評価器（evals/ からの相対パス → 中身）。to-ir.ts がテンプレートなどから取り込むもの */
  evalFiles?: Record<string, unknown>;
};

export type Context =
  | { index: string; folder: string; name?: string; description?: string; mode?: "semantic" | "structured" | "deeprag" | "batchtransform"; resultCount?: number; threshold?: number; fileExtension?: string; queryDescription?: string }
  | { dataFabric: string[]; folder: string; name?: string; description?: string }
  | { attachments: true; name: string; description?: string };

/** Data Fabric の表を探す関数（フォルダの中の表。テストでは差し替える） */
export type EntityLookup = (names: string[], folder: string) =>
  | { folderKey: string; entities: { id: string; name: string; description: string | null }[] }
  | { error: string };

export type Escalation = {
  /** Action Center のアプリの名前（ソリューションの中か、デプロイ済み） */
  app: string;
  folder?: string;
  name?: string;
  description?: string;
  /** タスクを受ける人のメールアドレス（1 人以上） */
  recipients: string[];
  /** 結果（アプリの outcomes）ごとに、エージェントが続けるか（continue）止まるか（end）。書かなければ全部 continue */
  outcomes?: Record<string, "continue" | "end">;
  title?: string;
};

/** Action Center のアプリの action schema（dotnet の型の引数の並び） */
export type ActionSchema = { version?: number; inputs?: Arg[]; inOuts?: Arg[]; outputs?: Arg[]; outcomes?: { name: string }[] };
type Arg = { name: string; type?: string; description?: string };
/** アプリを探す関数（ソリューションの中のファイルか CLI を読む。テストでは差し替える） */
export type AppLookup = (name: string, folder: string | undefined) =>
  | { key: string; name: string; folder: string; schema: ActionSchema }
  | { error: string };

/** Integration Service の活動と接続を探す関数（uip is resources describe と connections list。テストでは差し替える） */
export type IsLookup = (connector: string, activity: string, connection: string | undefined) =>
  | {
    meta: { DisplayName: string; Operation: { Method: string; Path: string; Description?: string };
      Parameters?: { Name: string; Type?: string; DisplayName?: string; Description?: string; Required?: boolean; In?: string; Location?: string }[];
      RequestFields?: IsField[]; ResponseFields?: IsField[] };
    connection: { id: string; name: string; folderKey: string; elementInstanceId?: number };
    connectorName: string;
    iconUrl: string;
  }
  | { error: string };
type IsField = { Name: string; Type?: string; DisplayName?: string; Description?: string; Enum?: (string | { name: string; value: string })[]; Required?: boolean };

/** MCP サーバーを探す関数（solution resources list / get。テストでは差し替える） */
export type McpLookup = (slug: string) =>
  | { key: string; slug: string; name: string; folder: string; description: string; tools: { name: string; description: string; inputSchema: unknown; outputSchema: unknown }[] }
  | { error: string };

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

/** Studio Web が書く組み込みの道具の形 */
const BUILTINS = JSON.parse(readFileSync(new URL("./builtin-tools.json", import.meta.url), "utf8")).tools;

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

function toolResource(t: Tool, i: number, lookup: ProcessLookup | undefined, project: string | undefined, probs: Problem[], isLookup?: IsLookup, mcpLookup?: McpLookup): Record<string, unknown> | undefined {
  const p = `tools[${i}]`;
  if ("raw" in t) return t.raw;
  if ("integration" in t) return integrationResource(t, i, isLookup, project, probs);
  if ("mcp" in t) {
    if (!mcpLookup) { probs.push({ path: p, code: "NEED_TENANT", message: "MCP の道具は --project で生成する（サーバーを探す）" }); return undefined; }
    const m = mcpLookup(t.mcp);
    if ("error" in m) { probs.push({ path: p, code: "MCP_NOT_FOUND", message: m.error }); return undefined; }
    const names = m.tools.map(x => x.name);
    for (const n of t.tools ?? []) if (!names.includes(n)) probs.push({ path: `${p}.tools`, code: "UNKNOWN_MCP_TOOL", message: `サーバーに道具 "${n}" が無い（ある物: ${names.join(", ")}）` });
    const picked = t.tools ? m.tools.filter(x => t.tools!.includes(x.name)) : m.tools;
    // Studio Web と同じ形：名前はサーバーの表示名、フォルダは solution_folder（ソリューションに取り込む。gen の最後に resources add で入れる）
    return {
      $resourceType: "mcp", id: (project && oldId(project, m.name)) ?? randomUUID(), name: m.name, description: t.description ?? (m.description || m.name),
      folderPath: "solution_folder", slug: m.slug,
      availableTools: picked.map(x => ({ ...x, argumentProperties: {} })),
      toolsConfiguration: t.tools ? { discoveryMode: { type: "cached" } } : { discoveryMode: { type: "dynamic", allowAll: true } },
      solutionProperties: { resourceKey: m.key, resourceName: m.name },
    };
  }
  if ("builtin" in t && t.builtin !== "analyze-attachments") {
    // DeepRAG・Batch Transform・Create File：Studio Web が書く形（builtin-tools.json）を写し、設定だけ入れる
    const tpl = (BUILTINS as any)[t.builtin];
    if (!tpl) { probs.push({ path: p, code: "BAD_BUILTIN", message: `組み込みの道具 "${t.builtin}" は無い（analyze-attachments / deep-rag / batch-transform / create-file）` }); return undefined; }
    const b = t as Extract<Tool, { builtin: string }> & Record<string, any>;
    const r = JSON.parse(JSON.stringify(tpl));
    r.name = b.name ?? r.name;
    if (b.description) r.description = b.description;
    const s = r.properties.settings;
    if (t.builtin === "deep-rag" || t.builtin === "batch-transform") {
      if (!b.task) { probs.push({ path: `${p}.task`, code: "MISSING", message: `${t.builtin} は task（何をするかの指示）が要る` }); return undefined; }
      s.query = { variant: "static", value: b.task };
      if (b.fileExtension) s.fileExtension = { value: b.fileExtension };
    }
    if (t.builtin === "deep-rag" && b.citations === false) s.citationMode = { value: "Skip" };
    if (t.builtin === "batch-transform") {
      if (!b.columns?.length) { probs.push({ path: `${p}.columns`, code: "MISSING", message: "batch-transform は columns（足す列の name と description）が要る" }); return undefined; }
      for (const c of b.columns) if (!/^[\w\s.,!?-]{1,500}$/.test(c.name)) probs.push({ path: `${p}.columns`, code: "BAD_NAME", message: `列の名前 "${c.name}" は英数字・空白・.,!?- だけ` });
      s.outputColumns = b.columns.map((c: any) => ({ name: c.name, description: c.description }));
      s.webSearchGrounding = { value: b.webSearch ? "Enabled" : "Disabled" };
    }
    return { ...r, id: (project && oldId(project, r.name)) ?? randomUUID() };
  }
  if ("builtin" in t) {
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

// ---------- コンテキスト ----------

const MODES = new Set(["semantic", "structured", "deeprag", "batchtransform"]);

function contextResource(c: Context, i: number, entities: EntityLookup | undefined, project: string | undefined, probs: Problem[]): Record<string, unknown> | undefined {
  const p = `contexts[${i}]`;
  const keepId = (n: string) => (project && oldId(project, n)) ?? randomUUID();
  if ("index" in c) {
    const name = c.name ?? c.index.replace(/[^A-Za-z0-9_]/g, "_");
    const mode = c.mode ?? "semantic";
    if (!MODES.has(mode)) { probs.push({ path: `${p}.mode`, code: "BAD_MODE", message: "mode は semantic / structured / deeprag / batchtransform（小文字）" }); return undefined; }
    const settings: Record<string, unknown> = {
      retrievalMode: mode,
      query: { variant: "dynamic", description: c.queryDescription ?? "Query for retrieval" },
      folderPathPrefix: { variant: "static" },
      fileExtension: { value: c.fileExtension ?? "All" },
      threshold: c.threshold ?? 0,
      resultCount: c.resultCount ?? 3,
    };
    if (mode === "deeprag") settings.citationMode = { value: "Inline" };
    // folderPath はインデックスのあるフォルダ。referenceKey は null にし、solution resources refresh が名前で引く
    return { $resourceType: "context", id: keepId(name), referenceKey: null, name, description: c.description ?? "", contextType: "index", folderPath: c.folder, indexName: c.index, settings };
  }
  if ("dataFabric" in c) {
    const name = c.name ?? "Entities";
    if (!entities) { probs.push({ path: p, code: "NEED_TENANT", message: "Data Fabric のコンテキストは --project で生成する（表を探す）" }); return undefined; }
    const found = entities(c.dataFabric, c.folder);
    if ("error" in found) { probs.push({ path: p, code: "ENTITY_NOT_FOUND", message: found.error }); return undefined; }
    return {
      $resourceType: "context", id: keepId(name), referenceKey: null, name, description: c.description ?? "", contextType: "datafabricentityset",
      entitySet: found.entities.map(e => ({ id: e.id, referenceKey: e.id, name: e.name, folderId: found.folderKey, folderDisplayName: c.folder, description: e.description, entityType: "native" })),
    };
  }
  if ("attachments" in c) {
    return {
      $resourceType: "context", id: keepId(c.name), referenceKey: null, name: c.name, description: c.description ?? "", contextType: "attachments", indexName: c.name, folderPath: "solution_folder",
      attachments: { description: "Array of files, documents, images to process." },
      settings: { retrievalMode: "semantic", query: { variant: "dynamic" }, folderPathPrefix: { variant: "static" }, fileExtension: { value: "All" }, threshold: 0, resultCount: 3 },
    };
  }
  probs.push({ path: p, code: "BAD_CONTEXT", message: "index / dataFabric / attachments のどれかを書く" });
  return undefined;
}

// ---------- エスカレーション ----------

const DOTNET: Record<string, string> = {
  "System.String": "string", "System.Int32": "number", "System.Int64": "number", "System.Decimal": "number", "System.Double": "number", "System.Boolean": "boolean",
};

function argsSchema(args: Arg[]): { schema: Record<string, unknown>; mapping: Record<string, string> } {
  const properties: Record<string, unknown> = {};
  const mapping: Record<string, string> = {};
  for (const a of args) {
    const t = a.type ?? "System.String";
    properties[a.name] = { type: DOTNET[t] ?? "string", ...(a.description ? { description: a.description } : {}) };
    mapping[a.name] = t;
  }
  return { schema: { type: "object", properties }, mapping };
}

function escalationResource(e: Escalation, i: number, lookup: AppLookup | undefined, project: string | undefined, probs: Problem[]): Record<string, unknown> | undefined {
  const p = `escalations[${i}]`;
  if (!e.recipients?.length) probs.push({ path: `${p}.recipients`, code: "NO_RECIPIENT", message: "タスクを受ける人のメールアドレスを 1 つ以上書く（空だとタスクがどこにも行かない）" });
  if (!lookup) { probs.push({ path: p, code: "NEED_TENANT", message: "エスカレーションは --project で生成する（アプリを探す）" }); return undefined; }
  const found = lookup(e.app, e.folder);
  if ("error" in found) { probs.push({ path: p, code: "APP_NOT_FOUND", message: found.error }); return undefined; }
  const s = found.schema;
  const outcomes = (s.outcomes ?? []).map(o => o.name);
  for (const k of Object.keys(e.outcomes ?? {})) if (!outcomes.includes(k)) probs.push({ path: `${p}.outcomes.${k}`, code: "UNKNOWN_OUTCOME", message: `アプリの結果に "${k}" が無い（ある物: ${outcomes.join(", ")}）` });
  const input = argsSchema([...(s.inputs ?? []), ...(s.inOuts ?? [])]);
  const output = argsSchema([...(s.inOuts ?? []), ...(s.outputs ?? [])]);
  const name = e.name ?? found.name.replace(/[^A-Za-z0-9_]/g, "_");
  const oldRes = project && existsSync(join(project, "resources", name, "resource.json")) ? readJson(join(project, "resources", name, "resource.json")) : undefined;
  const title = e.title ?? "Approval request";
  return {
    $resourceType: "escalation",
    id: oldRes?.id ?? randomUUID(),
    name,
    description: e.description ?? `Escalate to a human via the ${found.name} app`,
    escalationType: 0,
    isAgentMemoryEnabled: false,
    ixpToolId: null,
    storageBucketName: null,
    properties: {},
    governanceProperties: { isEscalatedAtRuntime: false },
    isEnabled: true,
    channels: [{
      id: oldRes?.channels?.[0]?.id ?? randomUUID(),
      name: "Channel",
      description: "Channel description",
      type: "actionCenter",
      inputSchema: input.schema,
      inputSchemaDotnetTypeMapping: input.mapping,
      outputSchema: output.schema,
      outputSchemaDotnetTypeMapping: output.mapping,
      outcomeMapping: Object.fromEntries(outcomes.map(o => [o, e.outcomes?.[o] ?? "continue"])),
      argumentProperties: {},
      properties: { resourceKey: found.key, appName: found.name, folderName: found.folder, appVersion: s.version || 1, isActionableMessageEnabled: false, actionableMessageMetaData: null },
      recipients: (e.recipients ?? []).map(v => ({ type: 3, value: v })),
      taskTitle: title,
      taskTitleV2: { type: "textBuilder", tokens: tokenize(title) },
      labels: [],
    }],
  };
}

// ---------- Integration Service の道具 ----------

const enumObjs = (e: IsField["Enum"]) => (e ?? []).map(v => (typeof v === "string" ? { name: v, value: v } : v));

function integrationResource(t: Extract<Tool, { integration: string }>, i: number, lookup: IsLookup | undefined, project: string | undefined, probs: Problem[]): Record<string, unknown> | undefined {
  const p = `tools[${i}]`;
  if (!lookup) { probs.push({ path: p, code: "NEED_TENANT", message: "Integration Service の道具は --project で生成する（活動と接続を探す）" }); return undefined; }
  const f = lookup(t.integration, t.activity, t.connection);
  if ("error" in f) { probs.push({ path: p, code: "IS_NOT_FOUND", message: f.error }); return undefined; }
  const req = f.meta.RequestFields ?? [];
  const known = new Set([...req.map(r => r.Name), ...(f.meta.Parameters ?? []).map(r => r.Name)]);
  for (const k of Object.keys(t.values ?? {})) if (!known.has(k)) probs.push({ path: `${p}.values.${k}`, code: "UNKNOWN_FIELD", message: `活動に "${k}" が無い（ある物: ${[...known].join(", ")}）` });
  for (const r of req) if (r.Name.includes(".")) probs.push({ path: p, code: "NESTED_FIELD", message: `入れ子の項目 "${r.Name}" は未対応。raw で書く` });

  // 入力：固定の値（values）と選択肢のある項目は LLM に渡さない。ほかは LLM が埋める
  const properties: Record<string, unknown> = {};
  const required: string[] = [];
  const parameters: Record<string, unknown>[] = [];
  let order = 1;
  const param = (r: IsField, loc: string) => {
    const enums = enumObjs(r.Enum);
    const fixed = t.values && r.Name in t.values;
    const isStatic = fixed || enums.length > 0;
    // 固定の項目も入力のスキーマに残す（Studio Web と同じ。enum を選んだ値だけにし、oneOf に選択肢を全部並べる）
    const prop: Record<string, unknown> = { type: r.Type ?? "string", title: r.DisplayName ?? r.Name, description: r.Description ?? "" };
    if (isStatic) {
      const v = fixed ? t.values![r.Name] : enums[0].value;
      prop.enum = [v];
      if (enums.length) prop.oneOf = enums.map(e => ({ const: e.value, title: e.name }));
    }
    properties[r.Name] = prop;
    if (r.Required) required.push(r.Name);
    parameters.push({
      name: r.Name, displayName: r.DisplayName ?? r.Name, type: r.Type ?? "string", fieldLocation: loc,
      value: fixed ? t.values![r.Name] : enums.length ? enums[0].value : "{{prompt}}",
      description: r.Description ?? "", position: r.Required ? "primary" : "secondary", sortOrder: order++, required: !!r.Required,
      fieldVariant: isStatic ? "static" : "dynamic", isCascading: false, dynamic: !isStatic,
      enumValues: enums.length ? enums : null, loadReferenceOptionsByDefault: null, dynamicBehavior: [], reference: null,
    });
  };
  for (const r of req) param(r, "body");
  for (const r of f.meta.Parameters ?? []) param(r, (r.In ?? r.Location ?? "query").toLowerCase());

  // 出力：results[*].title のような項目は "results[*]" をそのままキーにする（名前を変えると Studio Web が道具を落とす）
  const outProps: Record<string, unknown> = {};
  const defs: Record<string, { type: string; properties: Record<string, unknown> }> = {};
  for (const r of f.meta.ResponseFields ?? []) {
    const m = /^(.+\[\*\])\.(.+)$/.exec(r.Name);
    const field = { title: r.DisplayName ?? r.Name, type: r.Type ?? "string", description: r.Description ?? "" };
    if (m) {
      defs[m[1]] ??= { type: "object", properties: {} };
      defs[m[1]].properties[m[2]] = field;
      outProps[m[1]] = { title: m[1], type: "array", items: { $ref: `#/definitions/${m[1]}` } };
    } else outProps[r.Name] = field;
  }
  const outputSchema: Record<string, unknown> = { $schema: "http://json-schema.org/draft-07/schema#", type: "object", properties: outProps };
  if (Object.keys(defs).length) outputSchema.definitions = defs;

  const name = t.name ?? f.meta.DisplayName.replace(/[^A-Za-z0-9_]/g, "_");
  const desc = t.description ?? f.meta.Operation.Description ?? f.meta.DisplayName;
  return {
    $resourceType: "tool",
    id: (project && oldId(project, name)) ?? randomUUID(),
    type: "integration",
    location: "external",
    name,
    description: desc,
    isEnabled: true,
    inputSchema: { type: "object", properties, additionalProperties: false, ...(required.length ? { required } : {}) },
    outputSchema,
    iconUrl: f.iconUrl,
    settings: {},
    guardrail: { policies: [] },
    isPreview: false,
    properties: {
      toolPath: f.meta.Operation.Path,
      objectName: t.activity,
      toolDisplayName: f.meta.DisplayName,
      toolDescription: f.meta.Operation.Description ?? f.meta.DisplayName, // 活動の元の説明（description を上書きしても、こちらは元のまま）
      method: f.meta.Operation.Method,
      bodyStructure: { contentType: "json" },
      connection: {
        id: f.connection.id, name: f.connection.name, elementInstanceId: 0, apiBaseUri: "", state: "enabled", isDefault: false,
        connector: { key: t.integration, name: f.connectorName, image: f.iconUrl, enabled: true, isPreview: false },
        folder: { key: f.connection.folderKey, path: f.connection.folderKey },
        solutionProperties: { resourceKey: f.connection.id },
      },
      parameters,
    },
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
export function generate(ir: AgentIR, base: Record<string, any>, opts: { lookup?: ProcessLookup; appLookup?: AppLookup; entityLookup?: EntityLookup; isLookup?: IsLookup; mcpLookup?: McpLookup; project?: string } = {}): { result?: Generated; problems: Problem[] } {
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
    const r = toolResource(t, i, opts.lookup, opts.project, probs, opts.isLookup, opts.mcpLookup);
    if (!r) return;
    const n = String(r.name);
    if (resources[n]) probs.push({ path: `tools[${i}]`, code: "DUP_NAME", message: `名前 "${n}" が重なる` });
    resources[n] = r;
  });
  (ir.contexts ?? []).forEach((c, i) => {
    const r = contextResource(c, i, opts.entityLookup, opts.project, probs);
    if (!r) return;
    const n = String(r.name);
    if (resources[n]) probs.push({ path: `contexts[${i}]`, code: "DUP_NAME", message: `名前 "${n}" が重なる` });
    resources[n] = r;
  });
  (ir.escalations ?? []).forEach((e, i) => {
    const r = escalationResource(e, i, opts.appLookup, opts.project, probs);
    if (!r) return;
    const n = String(r.name);
    if (resources[n]) probs.push({ path: `escalations[${i}]`, code: "DUP_NAME", message: `名前 "${n}" が重なる` });
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

/** Action Center のアプリを探す。ソリューションの中（resources/solution_folder/app/workflow Action/<名前>.json と
 *  <アプリのプロジェクト>/.app/schemas/）を先に見て、無ければテナント（resources list / get の Spec.ActionSchema） */
export function appLookup(profile: string | undefined, solution: string | undefined): AppLookup {
  return (name, folder) => {
    if (solution && (!folder || folder === "solution_folder")) {
      // Studio Web は app/workflow Action/ に、uip solution resources refresh は app/ に置く
      const decl = [join(solution, "resources", "solution_folder", "app", "workflow Action", `${name}.json`), join(solution, "resources", "solution_folder", "app", `${name}.json`)].find(existsSync);
      if (decl) {
        const key = readJson(decl).resource?.key;
        for (const d of readdirSync(solution)) {
          const sd = join(solution, d, ".app", "schemas");
          if (!existsSync(sd)) continue;
          const uiproj = join(solution, d, "project.uiproj");
          const pname = existsSync(uiproj) ? readJson(uiproj).Name : d;
          if (pname !== name && d !== name) continue;
          const schema = readdirSync(sd).map(f => readJson(join(sd, f))).find(j => j.name === "ActionSchema");
          if (schema) return { key, name, folder: "solution_folder", schema };
        }
        return { error: `アプリ "${name}" の action schema（<アプリ>/.app/schemas/）がソリューションに無い` };
      }
    }
    const l = uip(["solution", "resources", "list", "--source", "remote", "--kind", "App", "--search", q(name)], profile, solution);
    if (!l.ok) return { error: `uip solution resources list が失敗した: ${l.text.slice(0, 300)}` };
    const rows = (l.json.Data as any[]).filter(r => r.Name === name && (!folder || r.Folder === folder) && /workflow action/i.test(String(r.Type)));
    if (rows.length !== 1) return { error: rows.length ? `"${name}" が複数のフォルダにある。folder を書く` : `Action Center のアプリ（Workflow Action）"${name}" が見つからない（Coded の Action App は使えない）` };
    const g = uip(["solution", "resources", "get", rows[0].Key], profile, solution);
    if (!g.ok) return { error: `uip solution resources get が失敗した: ${g.text.slice(0, 300)}` };
    const as = g.json.Data.Spec?.ActionSchema;
    if (!as) return { error: `"${name}" に ActionSchema が無い` };
    return { key: rows[0].Key, name, folder: rows[0].Folder, schema: typeof as === "string" ? JSON.parse(as) : as };
  };
}

/** Data Fabric の表をフォルダの中から探す（Agent Builder はフォルダの表しか使えない。テナントの表は見えない） */
export function entityLookup(profile: string | undefined): EntityLookup {
  return (names, folder) => {
    const f = uip(["or", "folders", "get", q(folder)], profile);
    const folderKey = f.ok ? (f.json.Data.Key ?? f.json.Data.key) : undefined;
    if (!folderKey) return { error: `フォルダ "${folder}" が見つからない` };
    const l = uip(["df", "entities", "list", "--folder-key", folderKey], profile);
    if (!l.ok) return { error: `uip df entities list が失敗した: ${l.text.slice(0, 300)}` };
    const rows = l.json.Data as any[];
    const out = [];
    for (const n of names) {
      const e = rows.find(r => r.Name === n && r.FolderId === folderKey);
      if (!e) return { error: `フォルダ "${folder}" に表 "${n}" が無い（テナントの表は使えない。--folder-key で作る）` };
      out.push({ id: e.Id, name: e.Name, description: e.Description ?? null });
    }
    return { folderKey, entities: out };
  };
}

/** Integration Service の活動の形（describe）と接続（connections list）を取る */
export function isLookup(profile: string | undefined): IsLookup {
  return (connector, activity, connection) => {
    const st = uip(["login", "status"], profile);
    if (!st.ok) return { error: "uip login status が失敗した" };
    const { BaseUrl, Organization, Tenant } = st.json.Data;
    // connections list はローカルのキャッシュも作る（solution resources refresh が debug_overwrites を作るのに使う）
    const l = uip(["is", "connections", "list", connector], profile);
    if (!l.ok) return { error: `uip is connections list が失敗した: ${l.text.slice(0, 300)}` };
    const rows = (l.json.Data as any[]).filter(r => r.State === "Enabled");
    const row = connection ? rows.find(r => r.Id === connection || r.Name === connection) : rows.find(r => r.IsDefault === "Yes") ?? rows[0];
    if (!row) return { error: `"${connector}" の使える接続が無い（uip is connections create ${connector} で作る）` };
    const d = uip(["is", "resources", "describe", connector, q(activity), "--connection-id", row.Id, "--operation", "Create"], profile);
    if (!d.ok) return { error: `uip is resources describe が失敗した: ${d.text.slice(0, 300)}` };
    return {
      meta: d.json.Data,
      connection: { id: row.Id, name: row.Name, folderKey: row.FolderKey, elementInstanceId: row.ElementInstanceId },
      connectorName: row.ConnectorName ?? connector,
      iconUrl: `${BaseUrl}/${Organization}/${Tenant}/elements_/v3/element/elements/${connector}/image`,
    };
  };
}

/** AgentHub の MCP サーバーを slug で探し、道具の一覧を取る */
export function mcpLookup(profile: string | undefined, cwd: string): McpLookup {
  return slug => {
    const l = uip(["solution", "resources", "list", "--source", "remote", "--kind", "mcpServer"], profile, cwd);
    if (!l.ok) return { error: `uip solution resources list が失敗した: ${l.text.slice(0, 300)}` };
    for (const row of l.json.Data as any[]) {
      const g = uip(["solution", "resources", "get", row.Key], profile, cwd);
      if (!g.ok) continue;
      const sp = g.json.Data.Spec ?? {};
      if (sp.Slug !== slug && row.Name !== slug) continue;
      const parse = (x: unknown) => (typeof x === "string" && x ? JSON.parse(x) : x ?? null);
      const tools = (sp.Tools ?? []).map((t: any) => {
        const inputSchema = parse(t.InputSchema) ?? { type: "object", properties: {} };
        const outputSchema = parse(t.OutputSchema);
        for (const s of [inputSchema, outputSchema]) if (s && typeof s === "object") delete (s as any).title;
        return { name: t.Name, description: t.Description ?? "", inputSchema, outputSchema };
      });
      return { key: row.Key, slug: sp.Slug ?? slug, name: sp.Name ?? row.Name, folder: row.Folder, description: sp.Description ?? "", tools };
    }
    return { error: `MCP サーバー "${slug}" が見つからない（uip agenthub mcp list で slug を確かめる）` };
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
  const { result, problems } = generate(ir, base, { lookup: cliLookup(profile, solution ?? dir), appLookup: appLookup(profile, solution), entityLookup: entityLookup(profile), isLookup: isLookup(profile), mcpLookup: mcpLookup(profile, solution ?? dir), project: dir });
  if (!result) return report(problems);

  writeProject(dir, ir, result);
  for (const e of result.evals)
    if (!e.expected || !Object.keys(e.expected).length)
      console.error(`注意 evals「${e.name}」: expected が無い。既定の評価器（出力の比較）はこのケースでエラーになる（振る舞いの評価器だけが点を付ける）`);

  // メモリ：features/ は IR が正本。一度消して uip agent memory add で付け直す
  const featDir = join(dir, "features");
  if (existsSync(featDir)) for (const d of readdirSync(featDir)) rmSync(join(featDir, d), { recursive: true, force: true });
  for (const m of ir.memory ?? []) {
    const args = ["agent", "memory", "add", q(m.name ?? m.space), "--memory-space", q(m.space), "--folder-path", q(m.folder), "--path", q(dir)];
    if (m.threshold !== undefined) args.push("--threshold", String(m.threshold));
    if (m.resultCount !== undefined) args.push("--result-count", String(m.resultCount));
    if (m.searchMode) args.push("--search-mode", m.searchMode);
    for (const [k, w] of Object.entries(m.fields ?? {})) args.push("--field", q(`${k}=${w}`));
    if (m.fewShot === false) args.push("--disable-dynamic-few-shot");
    const r = uip(args, profile);
    if (!r.ok) { console.error(`uip agent memory add が失敗した:
${r.text}`); return 1; }
  }

  for (const step of [["agent", "refresh", q(dir)], ["agent", "validate", q(dir)]]) {
    const r = uip(step, profile);
    if (!r.ok) { console.error(`uip ${step.slice(0, 2).join(" ")} が失敗した:\n${r.text}`); return 1; }
  }
  // ソリューションのリソースを取り込むのは、外（デプロイ済み）を指す道具・エスカレーションがあるときだけ。
  // ソリューションの中のアプリがあると refresh がその宣言を新しい key で作り直し、エスカレーションの resourceKey が宙に浮く
  const external = (r: Record<string, any>) =>
    r.$resourceType === "escalation" ? r.channels?.some((c: any) => c.properties?.folderName !== "solution_folder")
      : r.$resourceType === "mcp" ? false
        : r.$resourceType === "context" ? r.contextType !== "attachments"
          : r.type !== "internal";
  const hasLocalApp = Object.values(result.resources).some(r => r.$resourceType === "escalation" && (r as any).channels?.some((c: any) => c.properties?.folderName === "solution_folder"));
  const needsSolution = Object.values(result.resources).some(external) || (ir.memory ?? []).length > 0;
  if (needsSolution && hasLocalApp) console.error("注意 ソリューションの中のアプリと外のリソースを一緒に使うと、solution resources refresh がアプリの key を作り直す。refresh のあとにもう一度生成する");
  if (needsSolution && solution) {
    const r = uip(["solution", "resources", "refresh", "--solution-folder", q(solution)], profile);
    if (!r.ok) { console.error(`uip solution resources refresh が失敗した:\n${r.text}`); return 1; }
  }
  // MCP サーバーは refresh だと種類を取り違える（UiPath の種類を mCPServer/coded に置き、実行で Not Found）。
  // 間違った宣言を消し、resources add --source remote で取り込む（Studio Web と同じ mcpServer/<種類>/ と、道具が呼ぶプロセスも入る）
  const mcps = Object.values(result.resources).filter(r => r.$resourceType === "mcp") as any[];
  if (mcps.length && solution) {
    rmSync(join(solution, "resources", "solution_folder", "mCPServer"), { recursive: true, force: true });
    for (const m of mcps) {
      const r = uip(["solution", "resources", "add", "--source", "remote", "--kind", "MCPServer", "--name", q(m.name), "--cloud-key", m.solutionProperties.resourceKey, "--solution-folder", q(solution)], profile);
      if (!r.ok && !/already|exists/i.test(r.text)) { console.error(`uip solution resources add（MCP）が失敗した:\n${r.text}`); return 1; }
    }
  }
  console.log(`OK ${basename(dir)}: agent.json と resources ${Object.keys(result.resources).length} 個、評価 ${result.evals.length} 件。refresh → validate 済み`);
  return 0;
}

if (process.argv[1] && resolve(process.argv[1]) === resolve(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1"))) process.exit(main(process.argv));
