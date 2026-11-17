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
  /** IXP（Document Understanding）の抽出の道具。tag は IXP のプロジェクトのタグ（staging / live）。タグの付いたモデルだけ使える */
  | { ixp: string; tag: "staging" | "live"; name?: string; description?: string }
  /** AgentHub の MCP サーバー（slug）。tools で使う道具を絞る（書かなければ全部） */
  | { mcp: string; tools?: string[]; description?: string }
  /** Integration Service の活動。connection は接続の Id か名前（書かなければその connector の既定の接続）。values は固定の値 */
  | { integration: string; activity: string; connection?: string; name?: string; description?: string; values?: Record<string, unknown> }
  /**
   * 同じソリューションの中の coded function（Python / TS。Studio Web の Tools → Function、Preview）。function はプロジェクトのフォルダの名前。
   * 入出力は <プロジェクト>/entry-points.json、referenceKey は resources/solution_folder/process/function/<名前>.json の key（AUT-1201 の 16）
   */
  | { function: string; entry?: string; name?: string; description?: string }
  /** Client-side tool（会話型）。呼んだ側（ブラウザ・TypeScript SDK）で動く。input と output は JSON Schema（どちらも必須） */
  | { clientSide: string; description?: string; input: Record<string, unknown>; output: Record<string, unknown> }
  | { raw: Record<string, unknown> };
/**
 * どの道具にも confirm: true を書ける：会話型で、実行の前に利用者が承認・修正・拒否する（Studio Web の「Require confirmation」。
 * resource の properties.requireConversationalConfirmation）。形は 2026-11-17 に Studio Web で作って書き出したもの（AUT-1201 の 17）
 */
export type ToolCommon = { confirm?: boolean };

export type Guardrail =
  | { pii: string[]; threshold?: number; scopes?: string[]; tools?: string[]; action?: "block" | "log"; name?: string; reason?: string }
  | { harmful: string[]; threshold?: number; scopes?: string[]; action?: "block" | "log"; name?: string; reason?: string }
  | { promptInjection: number; action?: "block" | "log"; name?: string; reason?: string; severity?: Severity }
  /** 知的財産（IP protection）。実行の後だけ。Agent か Llm */
  | { ip: ("Text" | "Code")[]; scopes?: ("Agent" | "Llm")[]; action?: "block" | "log"; name?: string; reason?: string; severity?: Severity }
  /** User prompt attacks。実行の前だけ。Llm */
  | { userPromptAttacks: true; action?: "block" | "log"; name?: string; reason?: string; severity?: Severity }
  /** LLM as Judge。judge はルール（4,000 字まで）、model は判定のモデル、例は 2 つずつ・各 1,000 字まで、threshold は 0〜6（既定 2）。別に料金がかかる */
  | { judge: string; model: string; positive?: string[]; negative?: string[]; threshold?: number; scopes?: ("Agent" | "Llm" | "Tool")[]; tools?: string[]; action?: "block" | "log"; name?: string; reason?: string; severity?: Severity }
  /** 道具ごとのカスタムガードレール（$guardrailType: custom、Tool の 1 つだけ）。rules は AND */
  | { tool: string; rules: CustomRule[]; action?: "block" | "log"; name?: string; description?: string; reason?: string; severity?: Severity }
  | { raw: Record<string, unknown> };
/** カスタムガードレールの規則。fields を書かなければ全部の項目（$selectorType: all） */
export type CustomRule =
  | { always: "input" | "output" | "inputAndOutput" }
  | { word: string; value?: string; fields?: { path: string; source: "input" | "output"; title?: string }[] }
  | { number: string; value: number; fields?: { path: string; source: "input" | "output"; title?: string }[] }
  | { boolean: "equals"; value: boolean; fields?: { path: string; source: "input" | "output"; title?: string }[] };
/** action が log のときの重さ（既定 Warning） */
export type Severity = "Info" | "Warning" | "Error";

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
  /** Advanced harness（Preview）にするか。settings.mode が "advanced" になる。ガードレールとは一緒に使えない */
  harness?: "standard" | "advanced";
  description?: string;
  system: string;
  user?: string;
  input?: Record<string, Field>;
  output?: Record<string, Field>;
  tools?: (Tool & ToolCommon)[];
  /** エージェントのメモリ（memory space。先に Studio Web か agents_ の画面で作る）。features/ は CLI（uip agent memory add）が書く */
  memory?: { space: string; folder: string; name?: string; threshold?: number; resultCount?: number; searchMode?: "hybrid" | "semantic"; fields?: Record<string, number>; fewShot?: boolean }[];
  /** 知識（コンテキスト）。インデックス（RAG）・Data Fabric の表・実行時の添付 */
  contexts?: Context[];
  /** 人に上げる（Action Center のタスク）。アプリは Workflow Action の種類（Studio Web の「RPA app」の Action App） */
  escalations?: (Escalation | ValidationEscalation)[];
  /** 道具以外のリソース（コンテキスト・エスカレーション・MCP）。resource.json をそのまま書く */
  resources?: Record<string, unknown>[];
  guardrails?: Guardrail[];
  evals?: EvalCase[];
  /** 既定のほかの評価器（AUT-1201 の 19）。既定の評価セットの evaluatorRefs にも入る（defaultSet: false で外す） */
  evaluators?: EvaluatorIR[];
  /** 既定のほかの評価セット・評価器（evals/ からの相対パス → 中身）。to-ir.ts がテンプレートなどから取り込むもの */
  evalFiles?: Record<string, unknown>;
};

/**
 * 評価器の省略形。type・category は Studio Web の「Add evaluator」で作って書き出した値（2026-11-17）：
 * exact（Exact match、type 1・category 0）、json（JSON similarity、6・0）、semantic（LLM-as-a-judge の Semantic Similarity、5・1）、
 * trajectory（Trajectory、7・3）。semantic と trajectory は prompt と model を持つ（省けば Studio Web の既定の文と same-as-agent）
 */
export type EvaluatorIR = { name: string; kind: "exact" | "json" | "semantic" | "trajectory"; description?: string; target?: string; prompt?: string; model?: string; defaultSet?: boolean };
export const EVALUATOR_KIND = {
  exact: { type: 1, category: 0, description: "An evaluator that checks for exact string matches between expected and actual outputs" },
  json: { type: 6, category: 0, description: "An evaluator that compares the structural similarity between JSON objects" },
  semantic: { type: 5, category: 1, description: "An evaluator that uses a LLM to score the similarity of the actual output to the expected output",
    prompt: "As an expert evaluator, analyze the semantic similarity of these JSON contents to determine a score from 0-100. Focus on comparing the meaning and contextual equivalence of corresponding fields, accounting for alternative valid expressions, synonyms, and reasonable variations in language while maintaining high standards for accuracy and completeness. Provide your score with a justification, explaining briefly and concisely why you gave that score.\n----\nExpectedOutput:\n{{ExpectedOutput}}\n----\nActualOutput:\n{{ActualOutput}}\n" },
  trajectory: { type: 7, category: 3, description: "An evaluator that judges the agent based on its run history and expected behavior",
    prompt: "As an expert evaluator, determine how well the agent did on a scale of 0-100. Focus on if the simulation was successful and if the agent behaved according to the expected output accounting for alternative valid expressions, and reasonable variations in language while maintaining high standards for accuracy and completeness. Provide your score with a justification, explaining briefly and concisely why you gave that score.\n----\nUserOrSyntheticInputGivenToAgent:\n{{UserOrSyntheticInput}}\n----\nSimulationInstructions:\n{{SimulationInstructions}}\n----\nExpectedAgentBehavior:\n{{ExpectedAgentBehavior}}\n----\nAgentRunHistory:\n{{AgentRunHistory}}\n" },
} as const;
/** 評価器のファイル名（evals/evaluators/ の中） */
export const evaluatorFile = (name: string) => `evaluator-${name.replace(/[^A-Za-z0-9_-]+/g, "-").replace(/^-+|-+$/g, "").toLowerCase() || "x"}.json`;

export type Context =
  | { index: string; folder: string; name?: string; description?: string; mode?: "semantic" | "deeprag" | "batchtransform"; resultCount?: number; threshold?: number; fileExtension?: string; queryDescription?: string }
  | { dataFabric: string[]; folder: string; name?: string; description?: string }
  | { attachments: true; name: string; description?: string };

/** Data Fabric の表を探す関数（フォルダの中の表。テストでは差し替える） */
export type EntityLookup = (names: string[], folder: string) =>
  | { folderKey: string; entities: { id: string; name: string; description: string | null }[] }
  | { error: string };

/** 書類の確認（Document Validation Task）。IXP の道具の抽出結果を人に確かめてもらう。bucket は書類を置くストレージ */
export type ValidationEscalation = { validate: string; bucket: string; bucketFolder: string; name?: string; description?: string; recipients?: Recipient[] };

/**
 * タスクの受け手。文字列はメール（type 3）。ほかは resource の recipients[].type（スキル uipath-agents の guardrails.md の
 * 「Recipient shapes」。エスカレーションも同じ形）：
 * 1 { userId }（利用者の GUID）、2 { groupId }（グループの GUID）、5 { group }（グループの名前）、
 * 4 { assetEmail, folder }・6 { assetGroup, folder }（メール・グループ名を入れたアセットと、そのフォルダ）、
 * 7 { argEmail }・8 { argGroup }（メール・グループ名を入れたエージェントの入力。"user.email" のような点の道）、
 * 9 { workload, name? }（グループの中で仕事の少ない人）・10 { roundRobin, name? }（グループの中で順番に）。値はグループの GUID、
 * 11 { llm }（エージェントが実行時に受け手を推す。値はモデルへの説明。入力に dynamic__escalationRecipient が足される）。
 * 9〜11 は Studio Web の Assignment Criteria で作って書き出した形（2026-11-17）。受け手はそれ 1 つだけ
 */
export type Recipient = string | { userId: string } | { groupId: string } | { group: string }
  | { assetEmail: string; folder: string } | { assetGroup: string; folder: string } | { argEmail: string } | { argGroup: string }
  | { workload: string; name?: string } | { roundRobin: string; name?: string } | { llm: string };
type RecipientRes = { type: number; value?: string; displayName?: string; assetName?: string; folderPath?: string; argumentName?: string };
/** LLM inferred のときに Studio Web が入れる、モデルへの説明の既定 */
export const LLM_RECIPIENT_HINT = "Email address(es) of the person or team this should be escalated to.";
/** 受け手が 1 つだけでなければならない方式（9〜11） */
export const isSoloRecipient = (r: Recipient) => typeof r === "object" && r !== null && ("workload" in r || "roundRobin" in r || "llm" in r);
export function recipientResource(r: Recipient): RecipientRes | undefined {
  if (typeof r === "string") return { type: 3, value: r };
  const o = r as Record<string, string>;
  if (typeof o.userId === "string") return { type: 1, value: o.userId };
  if (typeof o.groupId === "string") return { type: 2, value: o.groupId };
  if (typeof o.group === "string") return { type: 5, value: o.group };
  if (typeof o.assetEmail === "string" && typeof o.folder === "string") return { type: 4, assetName: o.assetEmail, folderPath: o.folder };
  if (typeof o.assetGroup === "string" && typeof o.folder === "string") return { type: 6, assetName: o.assetGroup, folderPath: o.folder };
  if (typeof o.argEmail === "string") return { type: 7, argumentName: o.argEmail };
  if (typeof o.argGroup === "string") return { type: 8, argumentName: o.argGroup };
  if (typeof o.workload === "string") return { type: 9, value: o.workload, ...(o.name ? { displayName: o.name } : {}) };
  if (typeof o.roundRobin === "string") return { type: 10, value: o.roundRobin, ...(o.name ? { displayName: o.name } : {}) };
  if (typeof o.llm === "string") return { type: 11, value: "" };
  return undefined;
}
export function recipientIR(x: RecipientRes): Recipient | undefined {
  switch (x.type) {
    case 3: return x.value;
    case 1: return x.value ? { userId: x.value } : undefined;
    case 2: return x.value ? { groupId: x.value } : undefined;
    case 5: return x.value ? { group: x.value } : undefined;
    case 4: return x.assetName ? { assetEmail: x.assetName, folder: x.folderPath ?? "" } : undefined;
    case 6: return x.assetName ? { assetGroup: x.assetName, folder: x.folderPath ?? "" } : undefined;
    case 7: return x.argumentName ? { argEmail: x.argumentName } : undefined;
    case 8: return x.argumentName ? { argGroup: x.argumentName } : undefined;
    case 9: return x.value ? { workload: x.value, ...(x.displayName ? { name: x.displayName } : {}) } : undefined;
    case 10: return x.value ? { roundRobin: x.value, ...(x.displayName ? { name: x.displayName } : {}) } : undefined;
    case 11: return { llm: LLM_RECIPIENT_HINT };
  }
  return undefined;
}

export type Escalation = {
  /** Action Center のアプリの名前（ソリューションの中か、デプロイ済み） */
  app: string;
  folder?: string;
  name?: string;
  description?: string;
  /** タスクを受ける人（1 つ以上）。文字列はメール。グループなどは Recipient の形 */
  recipients: Recipient[];
  /** 結果（アプリの outcomes）ごとに、エージェントが続けるか（continue）止まるか（end）。書かなければ全部 continue */
  outcomes?: Record<string, "continue" | "end">;
  title?: string;
  /**
   * エスカレーションのメモリ（AUT-1201 の 18）：解決した件を覚え、似た件では人に聞かずに一番近い 1 件の結果を使う。
   * fields はアプリの入力の名前（配列なら等分、オブジェクトなら重み。合わせて 1）。エージェントに memory（memory space）が要る。
   * 形は Studio Web の Escalation memory で作って書き出した resource の properties.memory（2026-11-17）
   */
  memory?: { fields: string[] | Record<string, number>; threshold?: number; search?: "hybrid" | "semantic"; match?: "any" | "all" };
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

/** 前に生成した resource.json の id（作り直しても同じ id にする）。flow の中のエージェントはフォルダが id なので、name で探す */
function oldId(dir: string, name: string): string | undefined {
  const f = join(dir, "resources", name, "resource.json");
  if (existsSync(f)) { try { return readJson(f).id; } catch { return undefined; } }
  const rd = join(dir, "resources");
  if (!existsSync(rd)) return undefined;
  for (const d of readdirSync(rd)) {
    const g = join(rd, d, "resource.json");
    if (!existsSync(g)) continue;
    try { const r = readJson(g); if (r.name === name) return r.id; } catch { /* 読めない */ }
  }
  return undefined;
}

// ---------- 道具 ----------

function toolResource(t: Tool, i: number, lookup: ProcessLookup | undefined, project: string | undefined, probs: Problem[], isLookup?: IsLookup, mcpLookup?: McpLookup): Record<string, unknown> | undefined {
  const p = `tools[${i}]`;
  if ("raw" in t) return t.raw;
  if ("integration" in t) return integrationResource(t, i, isLookup, project, probs);
  if ("function" in t) {
    // Studio Web で Tools → Function を足して書き出した形（location solution、type function、properties の folderPath と processName）
    const sol = project && findSolution(project);
    if (!sol) { probs.push({ path: p, code: "NEED_TENANT", message: "function の道具は --project（ソリューションの中のエージェント）で生成する" }); return undefined; }
    const epFile = join(sol, t.function, "entry-points.json");
    const resFile = join(sol, "resources", "solution_folder", "process", "function", `${t.function}.json`);
    if (!existsSync(epFile) || !existsSync(resFile)) { probs.push({ path: `${p}.function`, code: "FUNCTION_NOT_FOUND", message: `ソリューションに関数 "${t.function}" が無い（${epFile} と ${resFile} が要る。Studio Web で作ったものは solution download で取る）` }); return undefined; }
    const eps: any[] = readJson(epFile).entryPoints ?? [];
    const ep = t.entry ? eps.find(e => e.name === t.entry || e.filePath === t.entry) : eps[0];
    if (!ep) { probs.push({ path: `${p}.entry`, code: "FUNCTION_NOT_FOUND", message: `関数 "${t.function}" に入口 "${t.entry ?? ""}" が無い（ある物: ${eps.map(e => e.name).join(", ")}）` }); return undefined; }
    const name = t.name ?? t.function;
    return {
      $resourceType: "tool", name, description: t.description ?? "", location: "solution", type: "function",
      inputSchema: ep.input ?? { type: "object", properties: {} }, outputSchema: ep.output ?? { type: "object", properties: {} },
      settings: {}, properties: { folderPath: "solution_folder", processName: t.function }, guardrail: { policies: [] },
      id: (project && oldId(project, name)) ?? randomUUID(), referenceKey: readJson(resFile).resource?.key, isEnabled: true, argumentProperties: {},
    };
  }
  if ("clientSide" in t) {
    const obj = (s: unknown) => !!s && typeof s === "object" && (s as any).type === "object";
    if (!/^[A-Za-z_][A-Za-z0-9_-]*$/.test(t.clientSide)) probs.push({ path: `${p}.clientSide`, code: "BAD_NAME", message: "Client-side tool の名前は英数字と _ -（関数の名前として渡る）" });
    if (!obj(t.input) || !obj(t.output)) { probs.push({ path: p, code: "CLIENT_SIDE_SCHEMA", message: "Client-side tool は input と output の JSON Schema（type: object）が両方要る" }); return undefined; }
    // Studio Web の「Client-side tools」→ Create new で作って書き出した形
    return {
      $resourceType: "tool", id: (project && oldId(project, t.clientSide)) ?? randomUUID(), name: t.clientSide, description: t.description ?? "",
      type: "clientSide", location: "solution", isEnabled: true, referenceKey: null,
      // properties.folderPath は Studio Web の書き出しには無いが、uip agent refresh / validate が求める（solution tools must use folderPath "solution_folder"）
      inputSchema: t.input, outputSchema: t.output, settings: {}, properties: { folderPath: "solution_folder" }, argumentProperties: {}, guardrail: { policies: [] },
    };
  }
  if ("ixp" in t) {
    if (t.tag !== "staging" && t.tag !== "live") { probs.push({ path: `${p}.tag`, code: "BAD_TAG", message: "tag は staging か live（IXP のプロジェクトでタグを付けたモデルだけ使える）" }); return undefined; }
    const name = t.name ?? t.ixp.replace(/[^A-Za-z0-9_]/g, "_");
    return {
      $resourceType: "tool", id: (project && oldId(project, name)) ?? randomUUID(), name, description: t.description ?? "Extract data from the document with IXP",
      location: "external", type: "ixp",
      inputSchema: { type: "object", properties: { attachment: { description: "File to extract data from.", $ref: "#/definitions/job-attachment" } }, required: ["attachment"], definitions: { "job-attachment": JOB_ATTACHMENT } },
      outputSchema: { type: "object", properties: {} },
      settings: {}, properties: { projectName: t.ixp, versionTag: t.tag }, guardrail: { policies: [] }, isEnabled: true, argumentProperties: {},
    };
  }
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

// Structured は 2026-09 に廃止（表のデータは Data Fabric のコンテキストで引く）。batchtransform は文書の Contexts のページに無いが、テナントで動いた形なので残す
const MODES = new Set(["semantic", "deeprag", "batchtransform"]);

function contextResource(c: Context, i: number, entities: EntityLookup | undefined, project: string | undefined, probs: Problem[]): Record<string, unknown> | undefined {
  const p = `contexts[${i}]`;
  const keepId = (n: string) => (project && oldId(project, n)) ?? randomUUID();
  if ("index" in c) {
    const name = c.name ?? c.index.replace(/[^A-Za-z0-9_]/g, "_");
    const mode = c.mode ?? "semantic";
    if (mode === "structured") { probs.push({ path: `${p}.mode`, code: "RETIRED_MODE", message: "検索方法 Structured は 2026-09 に廃止。表のデータは { \"dataFabric\": [\"表\"], \"folder\": \"…\" } のコンテキストで引く" }); return undefined; }
    if (!MODES.has(mode)) { probs.push({ path: `${p}.mode`, code: "BAD_MODE", message: "mode は semantic / deeprag / batchtransform（小文字）" }); return undefined; }
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
    if (c.dataFabric.length > 5) probs.push({ path: `${p}.dataFabric`, code: "TOO_MANY_ENTITIES", message: "Data Fabric のコンテキストは 5 つの表まで（文書の agent-contexts）" });
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
  if (!e.recipients?.length) probs.push({ path: `${p}.recipients`, code: "NO_RECIPIENT", message: "タスクを受ける人を 1 つ以上書く（メール、または { group } など。空だとタスクがどこにも行かない）" });
  (e.recipients ?? []).forEach((r, j) => { if (!recipientResource(r)) probs.push({ path: `${p}.recipients[${j}]`, code: "BAD_RECIPIENT", message: "受け手はメールの文字列か、{ userId } / { groupId } / { group } / { assetEmail, folder } / { assetGroup, folder } / { argEmail } / { argGroup } / { workload } / { roundRobin } / { llm } のどれか" }); });
  if ((e.recipients ?? []).some(isSoloRecipient) && (e.recipients ?? []).length > 1) probs.push({ path: `${p}.recipients`, code: "SOLO_RECIPIENT", message: "workload・roundRobin・llm は Studio Web では受け手 1 つだけの方式。ほかの受け手と並べない" });
  if (!lookup) { probs.push({ path: p, code: "NEED_TENANT", message: "エスカレーションは --project で生成する（アプリを探す）" }); return undefined; }
  const found = lookup(e.app, e.folder);
  if ("error" in found) { probs.push({ path: p, code: "APP_NOT_FOUND", message: found.error }); return undefined; }
  const s = found.schema;
  const outcomes = (s.outcomes ?? []).map(o => o.name);
  for (const k of Object.keys(e.outcomes ?? {})) if (!outcomes.includes(k)) probs.push({ path: `${p}.outcomes.${k}`, code: "UNKNOWN_OUTCOME", message: `アプリの結果に "${k}" が無い（ある物: ${outcomes.join(", ")}）` });
  const input = argsSchema([...(s.inputs ?? []), ...(s.inOuts ?? [])]);
  // LLM inferred：モデルが受け手を埋める入力を足す（型の対応表には入らない。Studio Web の書き出しと同じ）
  const llm = (e.recipients ?? []).find(r => typeof r === "object" && r !== null && "llm" in r) as { llm: string } | undefined;
  if (llm) (input.schema.properties as Record<string, unknown>).dynamic__escalationRecipient = { type: "string", title: "Recipient", description: llm.llm || LLM_RECIPIENT_HINT };
  const output = argsSchema([...(s.inOuts ?? []), ...(s.outputs ?? [])]);
  const name = e.name ?? found.name.replace(/[^A-Za-z0-9_]/g, "_");
  const oldRes = project && existsSync(join(project, "resources", name, "resource.json")) ? readJson(join(project, "resources", name, "resource.json")) : undefined;
  const title = e.title ?? "Approval request";
  // エスカレーションのメモリ：fields はアプリの入力（inputs・inOuts）の名前。id は前のものを名前で引き継ぐ
  let memory: Record<string, unknown> | undefined;
  if (e.memory) {
    const m = e.memory;
    const weights: Record<string, number> = Array.isArray(m.fields) ? Object.fromEntries(m.fields.map(f => [f, 1 / m.fields.length])) : (m.fields ?? {});
    const names = Object.keys(weights);
    const inputs = new Set([...(s.inputs ?? []), ...(s.inOuts ?? [])].map(a => a.name));
    if (!names.length) probs.push({ path: `${p}.memory.fields`, code: "ESC_MEMORY", message: "エスカレーションのメモリには引数が 1 つ以上要る" });
    for (const f of names) if (!inputs.has(f)) probs.push({ path: `${p}.memory.fields`, code: "ESC_MEMORY", message: `アプリの入力に "${f}" が無い（ある物: ${[...inputs].join(", ")}）` });
    const sum = names.reduce((a, f) => a + weights[f], 0);
    if (names.length && Math.abs(sum - 1) > 1e-6) probs.push({ path: `${p}.memory.fields`, code: "ESC_MEMORY", message: `重みは合わせて 1（100%）にする（いま ${sum}）` });
    if (m.threshold !== undefined && !(m.threshold >= 0 && m.threshold <= 1)) probs.push({ path: `${p}.memory.threshold`, code: "ESC_MEMORY", message: "threshold は 0〜1" });
    const oldIds = new Map<string, string>((oldRes?.properties?.memory?.fieldSettings ?? []).map((x: any) => [x.name, x.id]));
    memory = {
      isEnabled: true, threshold: m.threshold ?? 0.8, searchMode: m.search ?? "hybrid", fieldMatching: m.match === "all" ? "and" : "or",
      fieldSettings: names.map(f => ({ id: oldIds.get(f) ?? randomUUID(), name: f, weight: weights[f] })),
    };
  }
  return {
    $resourceType: "escalation",
    id: oldRes?.id ?? randomUUID(),
    name,
    description: e.description ?? `Escalate to a human via the ${found.name} app`,
    escalationType: 0,
    isAgentMemoryEnabled: false,
    ixpToolId: null,
    storageBucketName: null,
    properties: memory ? { memory } : {},
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
      recipients: (e.recipients ?? []).map(recipientResource).filter(Boolean),
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

function validationResource(e: ValidationEscalation, i: number, ir: AgentIR, project: string | undefined, probs: Problem[]): Record<string, unknown> | undefined {
  const p = `escalations[${i}]`;
  const ixpTools = (ir.tools ?? []).filter((t): t is Extract<Tool, { ixp: string }> => "ixp" in t).map(t => t.name ?? t.ixp.replace(/[^A-Za-z0-9_]/g, "_"));
  if (!ixpTools.includes(e.validate)) { probs.push({ path: `${p}.validate`, code: "UNKNOWN_IXP_TOOL", message: `IXP の道具 "${e.validate}" が tools に無い（ある物: ${ixpTools.join(", ") || "なし"}）` }); return undefined; }
  const name = e.name ?? "Validation";
  const oldRes = project && existsSync(join(project, "resources", name, "resource.json")) ? readJson(join(project, "resources", name, "resource.json")) : undefined;
  return {
    $resourceType: "escalation", id: oldRes?.id ?? randomUUID(), name, description: e.description ?? "",
    channels: [{
      id: oldRes?.channels?.[0]?.id ?? randomUUID(), name: "Channel", description: "Channel description",
      inputSchema: { type: "object", properties: {} }, inputSchemaDotnetTypeMapping: null,
      outputSchema: { type: "object", properties: {} }, outputSchemaDotnetTypeMapping: null,
      outcomeMapping: null, recipients: (e.recipients ?? []).map(recipientResource).filter(Boolean), type: "actionCenter",
      properties: { appName: null, appVersion: 1, folderName: null, resourceKey: null, isActionableMessageEnabled: false, actionableMessageMetaData: null },
      argumentProperties: {},
    }],
    isAgentMemoryEnabled: false, governanceProperties: { isEscalatedAtRuntime: false },
    escalationType: 1, properties: {},
    // バケットはソリューションに取り込む（gen の最後に resources add）
    vsEscalationProperties: { ixpToolId: e.validate, storageBucketName: e.bucket, storageBucketFolderPath: "solution_folder" },
    isEnabled: true,
  };
}

// ---------- ガードレール ----------

function guardrail(g: Guardrail, i: number, old: Record<string, string>, probs: Problem[]): Record<string, unknown> | undefined {
  if ("raw" in g) return g.raw;
  const action = (g.action ?? "block") === "block"
    ? { $actionType: "block", reason: g.reason ?? "Guardrail violation — execution blocked." }
    : { $actionType: "log", severityLevel: (g as { severity?: Severity }).severity ?? "Warning" };
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
  // 引数の形はテナントの uip agent guardrails list（Validator・Parameters）に合わせた（AUT-1201 の 7）
  if ("ip" in g) {
    return base(g.name ?? "IP protection guardrail", "Detects intellectual property in the output", "intellectual_property",
      [{ $parameterType: "enum-list", id: "ipEntities", value: g.ip }], { scopes: g.scopes ?? ["Agent"] });
  }
  if ("userPromptAttacks" in g) {
    return base(g.name ?? "User prompt attacks guardrail", "Detects attacks in the user prompt", "user_prompt_attacks", [], { scopes: ["Llm"] });
  }
  if ("judge" in g) {
    if (g.judge.length > 4000) probs.push({ path: `guardrails[${i}].judge`, code: "TOO_LONG", message: "judge（ルール）は 4,000 字まで" });
    for (const k of ["positive", "negative"] as const) {
      const ex = g[k] ?? [];
      if (ex.length > 2 || ex.some((s) => s.length > 1000)) probs.push({ path: `guardrails[${i}].${k}`, code: "TOO_MANY", message: "例は 2 つまで、各 1,000 字まで" });
    }
    const selector: Record<string, unknown> = { scopes: g.scopes ?? ["Agent"] };
    if (g.tools?.length) selector.matchNames = g.tools;
    return base(g.name ?? "LLM as judge guardrail", "Judges the content against a custom rule", "llm_as_judge", [
      { $parameterType: "text", id: "guardrailText", value: g.judge },
      { $parameterType: "enum", id: "model", value: g.model },
      { $parameterType: "text-list", id: "positiveExamples", value: g.positive ?? [] },
      { $parameterType: "text-list", id: "negativeExamples", value: g.negative ?? [] },
      { $parameterType: "number", id: "threshold", value: g.threshold ?? 2 },
    ], selector);
  }
  if ("tool" in g) {
    // 形はスキル uipath-agents の guardrails.md の「Custom Guardrails」
    const WORD = ["contains", "equals", "startsWith", "endsWith", "matchesRegex", "doesNotContain", "doesNotEqual", "doesNotStartWith", "doesNotEndWith", "isEmpty", "isNotEmpty"];
    const NUM = ["equals", "doesNotEqual", "greaterThan", "greaterThanOrEqual", "lessThan", "lessThanOrEqual"];
    if (!g.rules?.length) probs.push({ path: `guardrails[${i}].rules`, code: "MISSING", message: "rules を 1 つ以上書く" });
    const sel = (fs?: { path: string; source: string; title?: string }[]) => (fs?.length ? { $selectorType: "specific", fields: fs } : { $selectorType: "all" });
    const rules = (g.rules ?? []).map((r, j) => {
      const at = `guardrails[${i}].rules[${j}]`;
      if ("always" in r) return { $ruleType: "always", applyTo: r.always };
      if ("word" in r) {
        if (!WORD.includes(r.word)) probs.push({ path: at, code: "BAD_OPERATOR", message: `word の比べ方は ${WORD.join(" / ")}` });
        return { $ruleType: "word", fieldSelector: sel(r.fields), operator: r.word, ...(r.word === "isEmpty" || r.word === "isNotEmpty" ? {} : { value: r.value ?? "" }) };
      }
      if ("number" in r) {
        if (!NUM.includes(r.number)) probs.push({ path: at, code: "BAD_OPERATOR", message: `number の比べ方は ${NUM.join(" / ")}` });
        return { $ruleType: "number", fieldSelector: sel(r.fields), operator: r.number, value: r.value };
      }
      if ("boolean" in r) return { $ruleType: "boolean", fieldSelector: sel(r.fields), operator: "equals", value: r.value };
      probs.push({ path: at, code: "BAD_RULE", message: "always / word / number / boolean のどれかを書く" });
      return undefined;
    }).filter(Boolean);
    const name = g.name ?? `${g.tool} guardrail`;
    return { $guardrailType: "custom", id: old[name] ?? randomUUID(), name, description: g.description ?? "", enabledForEvals: true,
      selector: { scopes: ["Tool"], matchNames: [g.tool] }, action, rules };
  }
  probs.push({ path: `guardrails[${i}]`, code: "BAD_GUARDRAIL", message: "pii / harmful / promptInjection / ip / userPromptAttacks / judge / tool / raw のどれかを書く" });
  return undefined;
}

// ---------- 本体 ----------

export type Generated = { agent: Record<string, unknown>; resources: Record<string, Record<string, unknown>>; evals: EvalCase[] };

/** IR からエージェントの中身を作る。base は既にある agent.json（init が作ったもの） */
// 文書にある「使えない組み合わせ」（AUT-1191。agents の user-guide の tools-activities・limitations・analyze-files・
// working-with-files・agents-in-flow-limitations・define-arguments）。errors は止める、warnings は注意だけ
const WEB_SEARCH = /websearch/i;
export function combos(ir: AgentIR, opts: { inline?: boolean } = {}): { errors: Problem[]; warnings: Problem[] } {
  const errors: Problem[] = [], warnings: Problem[] = [];
  const tools = ir.tools ?? [];
  const gemini = /gemini/i.test(ir.model ?? "");
  const isFile = (f: Field | undefined) => f === "file" || f === "file[]" || (typeof f === "object" && f !== null && ((f as any).type === "file" || (f as any).type === "file[]"));
  const fileIns = Object.entries(ir.input ?? {}).filter(([, f]) => isFile(f)).map(([k]) => k);
  tools.forEach((t, i) => {
    const p = `tools[${i}]`;
    if (gemini && "integration" in t) errors.push({ path: p, code: "GEMINI_IS_TOOL", message: "Gemini のモデルでは Integration Service の活動の道具が無効になる。モデルを変えるか、道具を外す" });
    if (opts.inline) {
      if ("mcp" in t) errors.push({ path: p, code: "INLINE_UNSUPPORTED", message: "flow の中のエージェントでは MCP の道具を使えない" });
      if ("ixp" in t) errors.push({ path: p, code: "INLINE_UNSUPPORTED", message: "flow の中のエージェントでは IXP の道具を使えない（flow の IXP のノードを使う）" });
      if ("integration" in t && WEB_SEARCH.test(t.activity)) errors.push({ path: p, code: "INLINE_UNSUPPORTED", message: "flow の中のエージェントでは Web Search を使えない" });
    }
  });
  if (fileIns.length) {
    const canFile = tools.some((t) => "process" in t || "ixp" in t || ("builtin" in t && t.builtin !== "create-file"));
    if (!canFile) warnings.push({ path: "input", code: "NO_FILE_TOOL", message: `ファイルの入力（${fileIns.join(", ")}）を処理できる道具が無い。API ワークフロー・MCP・Integration Service の活動・エスカレーションはファイルを受けない。RPA・IXP・Analyze Files などを足す` });
    if (gemini && tools.some((t) => "builtin" in t && t.builtin === "analyze-attachments"))
      warnings.push({ path: "model", code: "GEMINI_FILES", message: "Gemini の Analyze Files は csv・txt・md・html だけを文書として読み、pdf は画像として扱う" });
  }
  // 自律型は、ユーザープロンプトで参照しない入力がエージェントに見えない
  if (ir.conversational !== true && ir.user) {
    const used = new Set(tokenize(ir.user).filter((t) => t.type === "variable").map((t) => /^input\.([A-Za-z_][A-Za-z0-9_]*)/.exec(t.rawString)?.[1]));
    for (const k of Object.keys(ir.input ?? {})) if (!used.has(k)) warnings.push({ path: `input.${k}`, code: "UNUSED_INPUT", message: `入力 "${k}" を user で {{input.${k}}} として参照していない。参照しない入力はエージェントに見えない` });
  }
  return { errors, warnings };
}

export function generate(ir: AgentIR, base: Record<string, any>, opts: { lookup?: ProcessLookup; appLookup?: AppLookup; entityLookup?: EntityLookup; isLookup?: IsLookup; mcpLookup?: McpLookup; project?: string; inline?: boolean } = {}): { result?: Generated; problems: Problem[]; warnings?: Problem[] } {
  const probs: Problem[] = [];
  const combo = combos(ir, { inline: opts.inline });
  probs.push(...combo.errors);
  if (ir.harness !== undefined && ir.harness !== "standard" && ir.harness !== "advanced") probs.push({ path: "harness", code: "BAD_HARNESS", message: "harness は standard か advanced" });
  if (ir.conversational === true && (ir.guardrails ?? []).some((g) => "promptInjection" in g)) probs.push({ path: "guardrails", code: "CONVERSATIONAL_PROMPT_INJECTION", message: "会話型では、エージェントの段の Prompt injection のガードレールを使えない（文書の conversational-agents-limitations）" });
  if (ir.harness === "advanced" && ir.guardrails?.length) probs.push({ path: "guardrails", code: "ADVANCED_GUARDRAILS", message: "Advanced harness ではガードレールを使えない（起動のとき「Guardrails are not yet supported for advanced agents.」で落ちる）" });
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
    if ("clientSide" in t && !conv) probs.push({ path: `tools[${i}]`, code: "CLIENT_SIDE_NOT_CONVERSATIONAL", message: "Client-side tool は会話型のエージェントだけ" });
    if ((t as ToolCommon).confirm !== undefined) {
      if (!conv) probs.push({ path: `tools[${i}].confirm`, code: "CONFIRM_NOT_CONVERSATIONAL", message: "confirm（実行前の承認）は会話型のエージェントだけ" });
      else if ((t as ToolCommon).confirm) r.properties = { ...(r.properties as object ?? {}), requireConversationalConfirmation: true };
    }
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
    if ("memory" in e && e.memory && !(ir.memory ?? []).length) probs.push({ path: `escalations[${i}].memory`, code: "ESC_MEMORY", message: "エスカレーションのメモリには、エージェントの memory（memory space）が要る" });
    const r = "validate" in e ? validationResource(e, i, ir, opts.project, probs) : escalationResource(e, i, opts.appLookup, opts.project, probs);
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
    if ("tool" in g && !toolNames.has(g.tool)) probs.push({ path: `guardrails[${i}].tool`, code: "UNKNOWN_TOOL", message: `道具 "${g.tool}" が無い` });
  });

  // 評価のケース：入力の名前を確かめる
  (ir.evals ?? []).forEach((e, i) => {
    for (const k of Object.keys(e.inputs ?? {})) if (!(inputSchema.properties as Record<string, unknown>)[k]) probs.push({ path: `evals[${i}].inputs.${k}`, code: "UNKNOWN_INPUT", message: `"${k}" が input に無い` });
    for (const k of Object.keys(e.expected ?? {})) if (!conv && !(outputSchema.properties as Record<string, unknown>)[k]) probs.push({ path: `evals[${i}].expected.${k}`, code: "UNKNOWN_OUTPUT", message: `"${k}" が output に無い` });
  });

  for (const rel of Object.keys(ir.evalFiles ?? {}))
    if (!/^(eval-sets|evaluators)\/[^/\\]+\.json$/.test(rel)) probs.push({ path: `evalFiles.${rel}`, code: "BAD_EVAL_FILE", message: "eval-sets/<名前>.json か evaluators/<名前>.json" });
  const evNames = new Set<string>();
  (ir.evaluators ?? []).forEach((e, i) => {
    const at = `evaluators[${i}]`;
    if (!e?.name?.trim()) probs.push({ path: `${at}.name`, code: "BAD_EVALUATOR", message: "評価器の name を書く" });
    else if (evNames.has(e.name) || ["Default Evaluator", "Default Trajectory Evaluator"].includes(e.name)) probs.push({ path: `${at}.name`, code: "BAD_EVALUATOR", message: `評価器の名前が重なっている（${e.name}）` });
    else if (ir.evalFiles?.[`evaluators/${evaluatorFile(e.name)}`] !== undefined) probs.push({ path: `${at}.name`, code: "BAD_EVALUATOR", message: `evalFiles の evaluators/${evaluatorFile(e.name)} と重なる` });
    evNames.add(e?.name);
    if (!(e?.kind in EVALUATOR_KIND)) probs.push({ path: `${at}.kind`, code: "BAD_EVALUATOR", message: `kind は ${Object.keys(EVALUATOR_KIND).join(" / ")}` });
    else if ((e.kind === "exact" || e.kind === "json") && (e.prompt !== undefined || e.model !== undefined)) probs.push({ path: at, code: "BAD_EVALUATOR", message: `${e.kind} は prompt・model を持たない（LLM を使わない評価器）` });
  });

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
      mode: ir.harness ?? s.mode ?? "standard",
    },
    inputSchema,
    outputSchema,
    messages: [
      { role: "system", content: ir.system, contentTokens: tokenize(ir.system) },
      { role: "user", content: conv ? "" : ir.user, contentTokens: conv ? [] : tokenize(ir.user!) },
    ],
  };
  if (guardrails.length) agent.guardrails = guardrails; else delete agent.guardrails;
  return { result: { agent, resources, evals: ir.evals ?? [] }, problems: [], warnings: combo.warnings };
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
    // 古い RPA のプロセスは V2 が無く、.NET の型の配列（Arguments.Input / Output）だけを持つ。JSON Schema に直す
    const unsupported: string[] = [];
    if (!inputSchema) { const raw = parse(spec.InputArgumentsSchema ?? spec.inputArgumentsSchema); if (Array.isArray(raw)) { inputSchema = dotnetArgsToSchema(raw); unsupported.push(...unsupportedDotnetArgs(raw)); } }
    if (!outputSchema) { const raw = parse(spec.OutputArgumentsSchema ?? spec.outputArgumentsSchema); if (Array.isArray(raw)) { outputSchema = dotnetArgsToSchema(raw); unsupported.push(...unsupportedDotnetArgs(raw)); } }
    if (unsupported.length) console.error(`注意 プロセス "${name}" の引数に、エージェントの道具で使えない型がある（文書の tools-processes）：${unsupported.join(", ")}`);
    for (const s of [inputSchema, outputSchema]) if (s) delete s.title;
    return { key: row.Key, name: row.Name, type: String(row.Type), folder: row.Folder, inputSchema, outputSchema };
  };
}

/** .NET の型の引数の並び（[{ name, type: "System.String, System.Private.CoreLib, …", required }]）を JSON Schema にする。
 *  型の対応はスキルの solution-files.md：String → string、Int32 / Int64 / Decimal / Double → number、Boolean → boolean、ほかは string。
 *  配列（String[] など）は array にする */
// 文書（tools-processes）で、エージェントの道具の古い RPA のプロセスに使える引数の型。ほかは使えないか失敗する（AUT-1201 の 10）
const AGENT_ARG_TYPES = new Set(["String", "Char", "Byte", "SByte", "UInt16", "Int16", "UInt32", "Int32", "UInt64", "Int64", "Double", "Single", "Decimal", "Boolean", "Object"]);
/** 使えない型の引数の名前と型（配列は中の型で判断する） */
export function unsupportedDotnetArgs(args: { name: string; type?: string }[]): string[] {
  return args.flatMap((a) => {
    const full = String(a.type ?? "System.String").split(",")[0].trim();
    const short = full.includes("`") ? "Object" : full.split(".").pop()!.replace(/(\[\])+$/, "");
    return AGENT_ARG_TYPES.has(short) ? [] : [`${a.name}（${full}）`];
  });
}

export function dotnetArgsToSchema(args: { name: string; type?: string; required?: boolean }[]): Record<string, unknown> {
  const one = (short: string): Record<string, unknown> => {
    if (short.endsWith("[]")) return { type: "array", items: one(short.slice(0, -2)) };
    if (short === "String") return { type: "string" };
    if (["Int32", "Int64", "Int16", "Decimal", "Double", "Single"].includes(short)) return { type: "number" };
    if (short === "Boolean") return { type: "boolean" };
    if (short === "DateTime" || short === "DateTimeOffset") return { type: "string", format: "date-time" };
    return { type: "string" };
  };
  const properties: Record<string, unknown> = {};
  const required: string[] = [];
  for (const a of args) {
    const full = String(a.type ?? "System.String").split(",")[0].trim();
    // 総称型（List`1[[System.String …]]）は中の型を取り出せないので string にする
    const short = full.includes("`") ? "Object" : full.split(".").pop()!;
    properties[a.name] = one(short);
    if (a.required) required.push(a.name);
  }
  return { type: "object", properties, ...(required.length ? { required } : {}) };
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

/** 評価器の省略形を書く。返すのは書いたファイル（evals/ からの相対パス） */
function writeEvaluators(project: string, list: EvaluatorIR[]): string[] {
  const dir = join(project, "evals", "evaluators");
  const now = new Date().toISOString();
  const written: string[] = [];
  const ids: { id: string; inSet: boolean }[] = [];
  // 前の評価器は名前で探す（Studio Web はファイル名に時刻を使う。名前の違うファイルは writeProject が消す）
  const before = new Map<string, any>(existsSync(dir) ? readdirSync(dir).filter(f => f.endsWith(".json")).map(f => readJson(join(dir, f))).map((j: any) => [j.name, j]) : []);
  for (const e of list) {
    const k = EVALUATOR_KIND[e.kind];
    const file = evaluatorFile(e.name);
    const old = before.get(e.name);
    const id = old?.id ?? randomUUID();
    const llm = "prompt" in k;
    writeJson(join(dir, file), {
      fileName: file, id, name: e.name, description: e.description ?? k.description, type: k.type, category: k.category,
      prompt: llm ? e.prompt ?? k.prompt : "", ...(llm ? { model: e.model ?? "same-as-agent" } : {}),
      targetOutputKey: e.target ?? "*", createdAt: old?.createdAt ?? now, updatedAt: now,
    });
    written.push(`evaluators/${file}`);
    ids.push({ id, inSet: e.defaultSet !== false });
  }
  // 既定の評価セットの evaluatorRefs：IR の評価器の id を足し、外すものは除く（Studio Web は新しい評価器を自動では足さない）
  const setFile = join(project, "evals", "eval-sets", "evaluation-set-default.json");
  if (list.length && existsSync(setFile)) {
    const set = readJson(setFile);
    const refs: string[] = (set.evaluatorRefs ?? []).filter((r: string) => !ids.some(x => x.id === r && !x.inSet));
    for (const x of ids) if (x.inSet && !refs.includes(x.id)) refs.push(x.id);
    set.evaluatorRefs = refs;
    writeJson(setFile, set);
  }
  return written;
}

/** 生成した中身をプロジェクトのフォルダに書く。resources/ と評価は IR が正本（IR に無いものは消す） */
export function writeProject(dir: string, ir: AgentIR, result: Generated, opts: { inline?: boolean } = {}) {
  writeJson(join(dir, "agent.json"), result.agent);
  // resources/ は IR が正本。IR に無いものは消す。flow の中のエージェントはフォルダの名前を resource の id（UUID）にする
  const resDir = join(dir, "resources");
  const folderOf = (n: string, r: Record<string, unknown>) => (opts.inline ? String(r.id) : n);
  const want = new Set(Object.entries(result.resources).map(([n, r]) => folderOf(n, r)));
  if (existsSync(resDir)) for (const d of readdirSync(resDir)) if (!want.has(d)) rmSync(join(resDir, d), { recursive: true, force: true });
  for (const [n, r] of Object.entries(result.resources)) writeJson(join(resDir, folderOf(n, r), "resource.json"), r);
  const up = join(dir, "project.uiproj");
  if (existsSync(up)) writeJson(up, { ...readJson(up), Name: ir.name, ...(ir.description !== undefined ? { Description: ir.description } : {}) });
  writeEvals(dir, result.evals);
  // 評価器の省略形：evaluators/evaluator-<名前>.json に書き（id は前のファイルから引き継ぐ）、既定の評価セットの evaluatorRefs に足す
  const evFiles = writeEvaluators(dir, ir.evaluators ?? []);
  // 既定のほかの評価セット・評価器も IR が正本。init が作る既定のもの以外で IR に無いファイルは消す
  const keep = new Set(["eval-sets/evaluation-set-default.json", "evaluators/evaluator-default.json", "evaluators/evaluator-default-trajectory.json", ...Object.keys(ir.evalFiles ?? {}), ...evFiles]);
  for (const sub of ["eval-sets", "evaluators"]) {
    const d = join(dir, "evals", sub);
    if (existsSync(d)) for (const f of readdirSync(d)) if (f.endsWith(".json") && !keep.has(`${sub}/${f}`)) rmSync(join(d, f));
  }
  for (const [rel, v] of Object.entries(ir.evalFiles ?? {})) {
    writeJson(join(dir, "evals", rel), v);
  }
  // 消した評価器を指す evaluatorRefs を外す
  const setFile = join(dir, "evals", "eval-sets", "evaluation-set-default.json");
  const evDir = join(dir, "evals", "evaluators");
  if (existsSync(setFile) && existsSync(evDir)) {
    const have = new Set(readdirSync(evDir).filter(f => f.endsWith(".json")).map(f => readJson(join(evDir, f)).id));
    const set = readJson(setFile);
    if (Array.isArray(set.evaluatorRefs) && set.evaluatorRefs.some((r: string) => !have.has(r))) {
      set.evaluatorRefs = set.evaluatorRefs.filter((r: string) => have.has(r));
      writeJson(setFile, set);
    }
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
  const inline = args.includes("--inline-in-flow");
  if (!irPath || (!project && !args.includes("--print"))) {
    console.error("使い方: node tools/agent/gen.ts <ir.json> --project <エージェントのフォルダ> [--inline-in-flow] [--profile <名前>] | --print\n  --inline-in-flow：flow の中のエージェント（<flow のフォルダ>/<UUID>）。無ければ --project に flow のフォルダを渡すと uip agent init --inline-in-flow で作る");
    return 2;
  }
  const ir = readJson(irPath) as AgentIR;
  const report = (probs: Problem[]) => { for (const p of probs) console.error(`NG ${p.path}: [${p.code}] ${p.message}`); return 1; };
  const notes = (ws: Problem[] | undefined) => { for (const w of ws ?? []) console.error(`注意 ${w.path}: [${w.code}] ${w.message}`); };

  if (!project) {
    const base = { version: "1.2.0", settings: {}, metadata: { storageVersion: "50.0.0", isConversational: ir.conversational === true, showProjectCreationExperience: false, targetRuntime: "pythonAgent" }, type: "lowCode", projectId: "<uip agent init が付ける>" };
    const { result, problems, warnings } = generate(ir, base, { inline });
    if (!result) return report(problems);
    notes(warnings);
    console.log(JSON.stringify(result.agent, null, 2));
    return 0;
  }

  let dir = resolve(project);
  if (inline && !existsSync(join(dir, "agent.json"))) {
    const init = uip(["agent", "init", q(dir), "--inline-in-flow", ...(ir.model ? ["--model", q(ir.model)] : [])], profile);
    if (!init.ok) { console.error(`uip agent init --inline-in-flow が失敗した:
${init.text}`); return 1; }
    dir = init.json.Data.Path;
    console.log(`作った（flow の中）: ${dir}  ← flow の uipath.agent.autonomous ノードの inputs.source に ${init.json.Data.ProjectId}`);
  }
  if (!existsSync(join(dir, "agent.json"))) {
    // 無ければ init。ソリューションの中ならそこに登録、外なら <名前>Solution/<名前> ができる
    const init = uip(["agent", "init", q(dir), ...(ir.conversational ? ["--conversational"] : []), ...(ir.model ? ["--model", q(ir.model)] : [])], profile);
    if (!init.ok) { console.error(`uip agent init が失敗した:\n${init.text}`); return 1; }
    dir = init.json.Data.Path;
    console.log(`作った: ${dir}`);
  }
  const solution = findSolution(dirname(dir));
  const base = readJson(join(dir, "agent.json"));
  const { result, problems, warnings } = generate(ir, base, { lookup: cliLookup(profile, solution ?? dir), appLookup: appLookup(profile, solution), entityLookup: entityLookup(profile), isLookup: isLookup(profile), mcpLookup: mcpLookup(profile, solution ?? dir), project: dir, inline });
  if (!result) return report(problems);
  notes(warnings);

  writeProject(dir, ir, result, { inline });
  if (inline) {
    // flow の中のエージェント：refresh / validate は --inline-in-flow。bindings は flow の bindings_v2.json に入れる。
    // 道具・コンテキスト・エスカレーションは flow にもノード（uipath.agent.resource.*、inputs.source = resource の id）が要る（Maestro の道具の側で書く）
    const flowDir = dirname(dir);
    const hasRes = Object.keys(result.resources).length > 0;
    const steps = [["agent", "refresh", q(dir), "--inline-in-flow", ...(hasRes ? ["--bindings-target", q(join(flowDir, "bindings_v2.json"))] : [])], ["agent", "validate", q(dir), "--inline-in-flow"]];
    for (const step of steps) {
      const r = uip(step, profile);
      if (!r.ok) { console.error(`uip ${step.slice(0, 2).join(" ")} --inline-in-flow が失敗した:
${r.text}`); return 1; }
    }
    if (hasRes) console.error("注意 flow の中のエージェントの resources は、flow にも uipath.agent.resource.* のノードを足してつなぐ（inputs.source = resource の id）。生成器は flow を書かない");
    console.log(`OK ${basename(dir)}（flow の中）: agent.json と resources ${Object.keys(result.resources).length} 個。refresh → validate 済み`);
    return 0;
  }
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
    r.$resourceType === "escalation" ? r.escalationType !== 1 && r.channels?.some((c: any) => c.properties?.folderName !== "solution_folder")
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
  // 書類の確認（Document Validation）のバケットは resources add --source remote で取り込む（Studio Web と同じく solution_folder に置く）
  for (const e of ir.escalations ?? []) {
    if (!("validate" in e) || !solution) continue;
    const r = uip(["solution", "resources", "add", "--source", "remote", "--kind", "Bucket", "--name", q(e.bucket), "--folder-path", q(e.bucketFolder), "--solution-folder", q(solution)], profile);
    if (!r.ok && !/already|exists/i.test(r.text)) { console.error(`uip solution resources add（バケット）が失敗した:\n${r.text}`); return 1; }
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
