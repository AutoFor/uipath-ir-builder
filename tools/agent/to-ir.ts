// ローコードのエージェントのプロジェクト（agent.json と resources/）を、生成器 gen.ts の IR に戻す。
// Studio Web の画面やテンプレートで作ったエージェントを取り込み、以後は IR を正本にして直すために使う。
//   uip solution download <ソリューションの Id> -d <dir> --extract   # Studio Web から取り出す
//   node tools/agent/to-ir.ts <エージェントのフォルダ> [--out <ir.json>]
// 生成器で作り直せる形にする：デプロイ済みのプロセスの道具は { process, folder }（引数の形は生成のときにテナントから取り直す）、
// 組み込みの道具は { builtin }、ほかの道具・コンテキスト・エスカレーション・ガードレールは raw でそのまま持つ。
// 終了コード: 0 = OK、2 = 使い方の間違い

import { existsSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import type { AgentIR, Context, Escalation, EvalCase, EvaluatorIR, Field, Guardrail, Tool, ValidationEscalation } from "./gen.ts";
import { EVALUATOR_KIND, LLM_RECIPIENT_HINT, recipientIR } from "./gen.ts";

/** uip agent init が作る評価器（生成の先に必ずあるので IR に持たない） */
const DEFAULT_EVALUATORS = new Set(["evaluator-default.json", "evaluator-default-trajectory.json"]);
/** Studio Web が書く組み込みの道具の形（gen.ts と同じもの） */
const BUILTINS = JSON.parse(readFileSync(new URL("./builtin-tools.json", import.meta.url), "utf8")).tools;
const PROCESS_TYPES = new Set(["process", "agent", "api", "processOrchestration"]);

function readJson(path: string): any {
  return JSON.parse(readFileSync(path, "utf8").replace(/^﻿/, ""));
}

const isAttachmentRef = (s: any) => s && typeof s.$ref === "string" && s.$ref.endsWith("/job-attachment");

/** JSON Schema の 1 項目を IR の省略形に戻す */
function toField(s: any, required: boolean, defaultRequired: boolean): Field {
  const reqMark = required === defaultRequired ? {} : { required };
  if (isAttachmentRef(s)) {
    const { $ref: _r, ...more } = s;
    return Object.keys(more).length || Object.keys(reqMark).length ? { type: "file", ...more, ...reqMark } : "file";
  }
  if (s?.type === "array" && isAttachmentRef(s.items) && Object.keys(s).length === 2 && !Object.keys(reqMark).length) return "file[]";
  const keys = Object.keys(s ?? {});
  if (keys.length === 1 && keys[0] === "type" && typeof s.type === "string" && !Object.keys(reqMark).length) return s.type;
  return { ...s, ...reqMark };
}

function toFields(schema: any, defaultRequired: boolean): Record<string, Field> | undefined {
  const props = schema?.properties ?? {};
  if (!Object.keys(props).length) return undefined;
  const req = new Set<string>(schema.required ?? []);
  return Object.fromEntries(Object.entries(props).map(([k, s]) => [k, toField(s, req.has(k), defaultRequired)]));
}

/** メッセージの本文。contentTokens があればそこから作る */
function textOf(m: any): string {
  if (!m) return "";
  if (!Array.isArray(m.contentTokens) || !m.contentTokens.length) return m.content ?? "";
  return m.contentTokens.map((t: any) => t.type === "variable" ? `{{${t.rawString}}}` : t.type === "expression" ? `@{${t.rawString}}` : t.rawString).join("");
}

/** コンテキストを省略形に戻す。戻せない形（ソリューションの中に取り込んだインデックスなど）は undefined（raw で持つ） */
function contextToIR(r: any): Context | undefined {
  if (r.contextType === "index" && r.folderPath && r.folderPath !== "solution_folder") {
    const s = r.settings ?? {};
    const c: any = { index: r.indexName, folder: r.folderPath };
    if (r.name !== String(r.indexName).replace(/[^A-Za-z0-9_]/g, "_")) c.name = r.name;
    if (r.description) c.description = r.description;
    if (s.retrievalMode && s.retrievalMode !== "semantic") c.mode = s.retrievalMode;
    if (s.resultCount !== undefined && s.resultCount !== 3) c.resultCount = s.resultCount;
    if (s.threshold !== undefined && s.threshold !== 0) c.threshold = s.threshold;
    if (s.fileExtension?.value && s.fileExtension.value !== "All") c.fileExtension = s.fileExtension.value;
    if (s.query?.description && s.query.description !== "Query for retrieval") c.queryDescription = s.query.description;
    return c;
  }
  if (r.contextType === "datafabricentityset" && r.entitySet?.length) {
    const folders = new Set(r.entitySet.map((e: any) => e.folderDisplayName));
    if (folders.size !== 1) return undefined;
    const c: any = { dataFabric: r.entitySet.map((e: any) => e.name), folder: [...folders][0] };
    if (r.name !== "Entities") c.name = r.name;
    if (r.description) c.description = r.description;
    return c;
  }
  if (r.contextType === "attachments") {
    const c: any = { attachments: true, name: r.name };
    if (r.description) c.description = r.description;
    return c;
  }
  return undefined;
}

/** エスカレーション（Action Center、受け手がメール）を省略形に戻す */
function escalationToIR(r: any): Escalation | ValidationEscalation | undefined {
  const ch = r.channels?.[0];
  if (r.escalationType === 1 && r.vsEscalationProperties?.ixpToolId) {
    // 書類の確認（Document Validation Task）。バケットのフォルダはソリューションの中に取り込んだ後は分からないので、元のフォルダは IR に書き足す
    const v: any = { validate: r.vsEscalationProperties.ixpToolId, bucket: r.vsEscalationProperties.storageBucketName, bucketFolder: r.vsEscalationProperties.bucketFolder ?? "Shared" };
    if (r.name !== "Validation") v.name = r.name;
    if (r.description) v.description = r.description;
    if (ch?.recipients?.length) v.recipients = ch.recipients.map(recipientIR);
    return v;
  }
  if (r.channels?.length !== 1 || ch?.type !== "actionCenter" || !ch.properties?.appName) return undefined;
  if ((ch.recipients ?? []).some((x: any) => !recipientIR(x))) return undefined;
  const e: any = { app: ch.properties.appName };
  if (ch.properties.folderName && ch.properties.folderName !== "solution_folder") e.folder = ch.properties.folderName;
  if (r.name !== String(ch.properties.appName).replace(/[^A-Za-z0-9_]/g, "_")) e.name = r.name;
  if (r.description && r.description !== `Escalate to a human via the ${ch.properties.appName} app`) e.description = r.description;
  // LLM inferred（11）の説明は入力の dynamic__escalationRecipient にある
  e.recipients = (ch.recipients ?? []).map((x: any) => x.type === 11
    ? { llm: ch.inputSchema?.properties?.dynamic__escalationRecipient?.description ?? LLM_RECIPIENT_HINT }
    : recipientIR(x));
  const ends = Object.entries(ch.outcomeMapping ?? {}).filter(([, v]) => v !== "continue");
  if (ends.length) e.outcomes = Object.fromEntries(ends);
  if (ch.taskTitle && ch.taskTitle !== "Approval request") e.title = ch.taskTitle;
  // エスカレーションのメモリ（properties.memory）
  const m = r.properties?.memory;
  if (m?.isEnabled) {
    const fs: any[] = m.fieldSettings ?? [];
    const equal = fs.every(f => Math.abs(f.weight - 1 / fs.length) < 1e-6);
    const mem: any = { fields: equal ? fs.map(f => f.name) : Object.fromEntries(fs.map(f => [f.name, f.weight])) };
    if (m.threshold !== undefined && m.threshold !== 0.8) mem.threshold = m.threshold;
    if (m.searchMode && m.searchMode !== "hybrid") mem.search = m.searchMode;
    if (m.fieldMatching === "and") mem.match = "all";
    e.memory = mem;
  } else if (r.properties && Object.keys(r.properties).some(k => k !== "memory")) return undefined;
  return e;
}

/** ソリューションの debug_overwrites.json から、資源（key）を当てたフォルダを探す */
function overwriteFolder(agentDir: string, key: string | undefined): string | undefined {
  if (!key) return undefined;
  for (let d = resolve(agentDir); ; d = join(d, "..")) {
    const up = join(d, "userProfile");
    if (existsSync(up)) {
      for (const u of readdirSync(up)) {
        const f = join(up, u, "debug_overwrites.json");
        if (!existsSync(f)) continue;
        for (const t of readJson(f).tenants ?? []) for (const r of t.resources ?? [])
          if (String(r.overwrite?.resourceKey ?? r.solutionResourceKey).toLowerCase() === key.toLowerCase() && r.overwrite?.folderPath) return r.overwrite.folderPath;
      }
      return undefined;
    }
    if (resolve(d, "..") === resolve(d)) return undefined;
  }
}

/** 評価器のファイルを省略形に戻す。知らない項目や種類があれば undefined（evalFiles のまま持つ） */
function evaluatorToIR(j: any, refs: Set<string>): EvaluatorIR | undefined {
  const known = new Set(["fileName", "id", "name", "description", "type", "category", "prompt", "model", "targetOutputKey", "createdAt", "updatedAt"]);
  if (Object.keys(j).some(k => !known.has(k)) || typeof j.name !== "string") return undefined;
  const kind = (Object.keys(EVALUATOR_KIND) as EvaluatorIR["kind"][]).find(k => EVALUATOR_KIND[k].type === j.type && EVALUATOR_KIND[k].category === j.category);
  if (!kind) return undefined;
  const k: any = EVALUATOR_KIND[kind];
  const e: EvaluatorIR = { name: j.name, kind };
  if (j.description && j.description !== k.description) e.description = j.description;
  if (j.targetOutputKey && j.targetOutputKey !== "*") e.target = j.targetOutputKey;
  if (k.prompt) {
    if (j.prompt && j.prompt !== k.prompt) e.prompt = j.prompt;
    if (j.model && j.model !== "same-as-agent") e.model = j.model;
  } else if (j.prompt || j.model) return undefined;
  if (!refs.has(j.id)) e.defaultSet = false;
  return e;
}

/** 生成器の省略形で書けるガードレールは省略形に、ほかは raw に戻す */
function guardrailToIR(g: any): Guardrail {
  const raw = { raw: g };
  if (g.$guardrailType === "custom") return customToIR(g) ?? raw;
  if (g.$guardrailType !== "builtInValidator") return raw;
  const param = (id: string) => (g.validatorParameters ?? []).find((p: any) => p.id === id)?.value;
  const act = g.action?.$actionType;
  if (act !== "block" && act !== "log") return raw;
  const common: Record<string, unknown> = { action: act };
  if (act === "log" && g.action.severityLevel !== "Warning") common.severity = g.action.severityLevel;
  if (act === "block" && g.action.reason !== "Guardrail violation — execution blocked.") common.reason = g.action.reason;
  const uniform = (m: any, list: string[]) => {
    const vs = list.map(e => m?.[e]);
    return vs.length && vs.every(v => v === vs[0]) && Object.keys(m ?? {}).length === list.length ? vs[0] : undefined;
  };
  if (g.validatorType === "pii_detection" && (g.validatorParameters ?? []).length === 2) {
    const ents = param("entities"); const th = uniform(param("entityThresholds"), ents ?? []);
    if (!Array.isArray(ents) || th === undefined || g.name !== "PII detection guardrail") return raw;
    const ir: Record<string, unknown> = { pii: ents, threshold: th, scopes: g.selector?.scopes ?? ["Agent"], ...common };
    if (g.selector?.matchNames?.length) ir.tools = g.selector.matchNames;
    if (th === 0.8) delete ir.threshold;
    return ir as Guardrail;
  }
  if (g.validatorType === "harmful_content" && (g.validatorParameters ?? []).length === 2) {
    const ents = param("harmfulContentEntities"); const th = uniform(param("harmfulContentEntityThresholds"), ents ?? []);
    if (!Array.isArray(ents) || th === undefined || g.name !== "Harmful content guardrail" || g.selector?.matchNames) return raw;
    const ir: Record<string, unknown> = { harmful: ents, threshold: th, scopes: g.selector?.scopes ?? ["Agent"], ...common };
    if (th === 2) delete ir.threshold;
    return ir as Guardrail;
  }
  if (g.validatorType === "prompt_injection" && g.name === "Prompt injection guardrail" && typeof param("threshold") === "number") {
    return { promptInjection: param("threshold"), ...common } as Guardrail;
  }
  if (g.validatorType === "intellectual_property" && g.name === "IP protection guardrail" && Array.isArray(param("ipEntities"))) {
    return { ip: param("ipEntities"), scopes: g.selector?.scopes ?? ["Agent"], ...common } as Guardrail;
  }
  if (g.validatorType === "user_prompt_attacks" && g.name === "User prompt attacks guardrail") {
    return { userPromptAttacks: true, ...common } as Guardrail;
  }
  if (g.validatorType === "llm_as_judge" && g.name === "LLM as judge guardrail" && typeof param("guardrailText") === "string") {
    const ir: Record<string, unknown> = { judge: param("guardrailText"), model: param("model"), scopes: g.selector?.scopes ?? ["Agent"], ...common };
    if (param("positiveExamples")?.length) ir.positive = param("positiveExamples");
    if (param("negativeExamples")?.length) ir.negative = param("negativeExamples");
    if (param("threshold") !== 2) ir.threshold = param("threshold");
    if (g.selector?.matchNames?.length) ir.tools = g.selector.matchNames;
    return ir as Guardrail;
  }
  return raw;
}

/** 道具ごとのカスタムガードレールを省略形に戻す。戻せない形（Tool が 1 つでない、escalate など）は undefined */
function customToIR(g: any): Guardrail | undefined {
  const names = g.selector?.matchNames ?? [];
  if (g.selector?.scopes?.length !== 1 || g.selector.scopes[0] !== "Tool" || names.length !== 1) return undefined;
  const act = g.action?.$actionType;
  if (act !== "block" && act !== "log" && act !== "filter") return undefined;
  const fields = (fs: any) => (fs?.$selectorType === "specific" ? { fields: fs.fields } : {});
  const rules: any[] = [];
  for (const r of g.rules ?? []) {
    if (r.$ruleType === "always") rules.push({ always: r.applyTo });
    else if (r.$ruleType === "word") rules.push({ word: r.operator, ...(r.value !== undefined ? { value: r.value } : {}), ...fields(r.fieldSelector) });
    else if (r.$ruleType === "number") rules.push({ number: r.operator, value: r.value, ...fields(r.fieldSelector) });
    else if (r.$ruleType === "boolean") rules.push({ boolean: "equals", value: r.value, ...fields(r.fieldSelector) });
    else return undefined;
  }
  const ir: Record<string, unknown> = { tool: names[0], rules, action: act };
  if (g.name !== `${names[0]} guardrail`) ir.name = g.name;
  if (g.description) ir.description = g.description;
  if (act === "block" && g.action.reason !== "Guardrail violation — execution blocked.") ir.reason = g.action.reason;
  if (act === "log" && g.action.severityLevel !== "Warning") ir.severity = g.action.severityLevel;
  if (act === "filter") ir.filter = (g.action.fields ?? []).map((f: any) => ({ path: f.path, source: f.source }));
  return ir as Guardrail;
}

export function toIR(dir: string): AgentIR {
  const agent = readJson(join(dir, "agent.json"));
  const uiproj = existsSync(join(dir, "project.uiproj")) ? readJson(join(dir, "project.uiproj")) : {};
  const conv = agent.metadata?.isConversational === true;
  const s = agent.settings ?? {};
  const sys = (agent.messages ?? []).find((m: any) => m.role === "system");
  const usr = (agent.messages ?? []).find((m: any) => m.role === "user");

  const ir: AgentIR = { name: uiproj.Name ?? dir.split(/[\\/]/).pop()! } as AgentIR;
  if (uiproj.Description) ir.description = uiproj.Description;
  if (conv) ir.conversational = true;
  Object.assign(ir, { model: s.model, temperature: s.temperature, maxTokens: s.maxTokens, maxIterations: s.maxIterations });
  if (s.mode === "advanced") ir.harness = "advanced";
  // 本文は contentTokens から組み直す（古い形では content が {{Content}}、トークンが input.Content のことがある）
  ir.system = textOf(sys);
  if (!conv) ir.user = textOf(usr);
  const input = toFields(agent.inputSchema, true);
  if (input) ir.input = input;
  if (!conv) { const output = toFields(agent.outputSchema, false); if (output) ir.output = output; }

  // resources/
  const tools: Tool[] = [];
  const contexts: Context[] = [];
  const escalations: (Escalation | ValidationEscalation)[] = [];
  const others: Record<string, unknown>[] = [];
  const resDir = join(dir, "resources");
  for (const d of existsSync(resDir) ? readdirSync(resDir).sort() : []) {
    const f = join(resDir, d, "resource.json");
    if (!existsSync(f)) continue;
    const r = readJson(f);
    const before = tools.length;
    readOne();
    // 会話型の「Require confirmation」は、どの道具でも confirm: true に戻す（raw は resource のまま持つ）
    const last: any = tools[tools.length - 1];
    if (tools.length > before && !("raw" in last) && r.properties?.requireConversationalConfirmation === true) last.confirm = true;
    continue;
    function readOne() {
    if (r.$resourceType === "tool" && PROCESS_TYPES.has(r.type) && r.properties?.processName) {
      const t: Tool = { process: r.properties.processName, folder: r.properties.folderPath };
      if (r.name !== r.properties.processName) (t as any).name = r.name;
      if (r.description) (t as any).description = r.description;
      if (r.properties.exampleCalls?.length) (t as any).examples = r.properties.exampleCalls;
      tools.push(t);
    } else if (r.$resourceType === "tool" && r.type === "internal" && r.properties?.toolType === "analyze-attachments") {
      const t: Tool = { builtin: "analyze-attachments" };
      if (r.name !== "AnalyzeFiles") (t as any).name = r.name;
      tools.push(t);
    } else if (r.$resourceType === "tool" && r.type === "internal" && ["deep-rag", "batch-transform", "create-file"].includes(r.properties?.toolType)) {
      const tt = r.properties.toolType;
      const tpl = (BUILTINS as any)[tt];
      const t: any = { builtin: tt };
      if (r.name !== tpl.name) t.name = r.name;
      if (r.description && r.description !== tpl.description) t.description = r.description;
      const s = r.properties.settings ?? {};
      if (tt !== "create-file") {
        if (s.query?.value) t.task = s.query.value;
        if (s.fileExtension?.value && s.fileExtension.value !== tpl.properties.settings.fileExtension?.value) t.fileExtension = s.fileExtension.value;
      }
      if (tt === "deep-rag" && s.citationMode?.value === "Skip") t.citations = false;
      if (tt === "batch-transform") {
        t.columns = (s.outputColumns ?? []).map((c: any) => ({ name: c.name, description: c.description }));
        if (s.webSearchGrounding?.value === "Enabled") t.webSearch = true;
      }
      tools.push(t);
    } else if (r.$resourceType === "tool" && r.type === "ixp" && r.properties?.projectName) {
      const t: any = { ixp: r.properties.projectName, tag: r.properties.versionTag };
      if (r.name !== String(r.properties.projectName).replace(/[^A-Za-z0-9_]/g, "_")) t.name = r.name;
      if (r.description && r.description !== "Extract data from the document with IXP") t.description = r.description;
      tools.push(t);
    } else if (r.$resourceType === "tool" && r.type === "integration" && r.properties?.objectName && r.properties?.connection?.connector?.key) {
      const t: any = { integration: r.properties.connection.connector.key, activity: r.properties.objectName };
      if (r.name !== String(r.properties.toolDisplayName ?? "").replace(/[^A-Za-z0-9_]/g, "_")) t.name = r.name;
      if (r.description && r.description !== r.properties.toolDescription) t.description = r.description;
      const statics = (r.properties.parameters ?? []).filter((p: any) => p.fieldVariant === "static");
      if (statics.length) t.values = Object.fromEntries(statics.map((p: any) => [p.name, p.value]));
      tools.push(t);
    } else if (r.$resourceType === "tool" && r.type === "function" && r.location === "solution" && r.properties?.processName) {
      const t: any = { function: r.properties.processName };
      if (r.name !== r.properties.processName) t.name = r.name;
      if (r.description) t.description = r.description;
      tools.push(t);
    } else if (r.$resourceType === "tool" && r.type === "clientSide" && r.inputSchema && r.outputSchema) {
      const t: any = { clientSide: r.name };
      if (r.description) t.description = r.description;
      t.input = r.inputSchema;
      t.output = r.outputSchema;
      tools.push(t);
    } else if (r.$resourceType === "tool") {
      tools.push({ raw: r });
    } else if (r.$resourceType === "mcp" && r.slug) {
      const t: any = { mcp: r.slug };
      if (r.toolsConfiguration?.discoveryMode?.type === "cached") t.tools = (r.availableTools ?? []).map((x: any) => x.name);
      tools.push(t);
    } else if (r.$resourceType === "context" && contextToIR(r)) {
      contexts.push(contextToIR(r)!);
    } else if (r.$resourceType === "escalation" && escalationToIR(r)) {
      escalations.push(escalationToIR(r)!);
    } else {
      others.push(r);
    }
    }
  }
  if (tools.length) ir.tools = tools;
  if (contexts.length) ir.contexts = contexts;
  if (escalations.length) ir.escalations = escalations;
  if (others.length) ir.resources = others;

  // メモリ（features/<名前>/feature.json。uip agent memory が書いたもの）
  const featDir = join(dir, "features");
  const memory: NonNullable<AgentIR["memory"]> = [];
  for (const d of existsSync(featDir) ? readdirSync(featDir).sort() : []) {
    const f = join(featDir, d, "feature.json");
    if (!existsSync(f)) continue;
    const m = readJson(f);
    if (m.$featureType !== "memorySpace") continue;
    // Studio Web で作った memory space は folderPath が solution_folder。実際のフォルダは
    // userProfile/<利用者>/debug_overwrites.json の overwrite（resourceKey が feature の referenceKey）にある
    const folder = m.folderPath === "solution_folder" ? overwriteFolder(dir, m.referenceKey) ?? m.folderPath : m.folderPath;
    const e: NonNullable<AgentIR["memory"]>[number] = { space: m.memorySpaceName, folder };
    if (m.name !== m.memorySpaceName) e.name = m.name;
    const s = m.dynamicFewShotSettings ?? {};
    if (s.isEnabled === false) e.fewShot = false;
    if (s.threshold !== undefined && s.threshold !== 0) e.threshold = s.threshold;
    if (s.resultCount !== undefined && s.resultCount !== 3) e.resultCount = s.resultCount;
    if (s.searchMode && s.searchMode !== "hybrid") e.searchMode = s.searchMode;
    if (s.fieldSettings?.length) e.fields = Object.fromEntries(s.fieldSettings.map((x: any) => [x.name, x.weight]));
    memory.push(e);
  }
  if (memory.length) ir.memory = memory;
  if (agent.guardrails?.length) ir.guardrails = agent.guardrails.map(guardrailToIR);

  // 評価のケース（既定の評価セット。無ければ最初のもの）
  const evDir = join(dir, "evals", "eval-sets");
  const files = existsSync(evDir) ? readdirSync(evDir).filter(f => f.endsWith(".json")).sort() : [];
  const file = files.includes("evaluation-set-default.json") ? "evaluation-set-default.json" : files[0];
  if (file) {
    const cases: EvalCase[] = (readJson(join(evDir, file)).evaluations ?? []).map((e: any) => {
      const c: EvalCase = { name: e.name, inputs: e.inputs ?? {} };
      if (e.expectedOutput && Object.keys(e.expectedOutput).length) c.expected = e.expectedOutput;
      if (e.expectedAgentBehavior) c.behavior = e.expectedAgentBehavior;
      if (e.simulateTools) c.simulateTools = true;
      if (e.simulationInstructions) c.simulationInstructions = e.simulationInstructions;
      return c;
    });
    if (cases.length) ir.evals = cases;
  }
  // 既定のほかの評価セットと評価器（テンプレートの「完全一致」など）はファイルのまま持つ
  const evalFiles: Record<string, unknown> = {};
  for (const f of files) if (f !== file) evalFiles[`eval-sets/${f}`] = readJson(join(evDir, f));
  const erDir = join(dir, "evals", "evaluators");
  const refs = new Set<string>(file ? readJson(join(evDir, file)).evaluatorRefs ?? [] : []);
  const evaluators: EvaluatorIR[] = [];
  for (const f of existsSync(erDir) ? readdirSync(erDir).filter(f => f.endsWith(".json")).sort() : []) {
    if (DEFAULT_EVALUATORS.has(f)) continue;
    const j = readJson(join(erDir, f));
    const e = evaluatorToIR(j, refs);
    if (e) evaluators.push(e); else evalFiles[`evaluators/${f}`] = j;
  }
  if (evaluators.length) ir.evaluators = evaluators;
  if (Object.keys(evalFiles).length) ir.evalFiles = evalFiles;
  return ir;
}

function main(argv: string[]): number {
  const args = argv.slice(2);
  const dir = args[0];
  const oi = args.indexOf("--out");
  if (!dir || dir.startsWith("--") || !existsSync(join(dir, "agent.json"))) {
    console.error("使い方: node tools/agent/to-ir.ts <エージェントのフォルダ（agent.json がある所）> [--out <ir.json>]");
    return 2;
  }
  const text = JSON.stringify(toIR(resolve(dir)), null, 2) + "\n";
  if (oi >= 0) writeFileSync(args[oi + 1], text); else process.stdout.write(text);
  return 0;
}

if (process.argv[1] && resolve(process.argv[1]) === resolve(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1"))) process.exit(main(process.argv));
