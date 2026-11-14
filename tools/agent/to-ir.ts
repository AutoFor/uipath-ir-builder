// ローコードのエージェントのプロジェクト（agent.json と resources/）を、生成器 gen.ts の IR に戻す。
// Studio Web の画面やテンプレートで作ったエージェントを取り込み、以後は IR を正本にして直すために使う。
//   uip solution download <ソリューションの Id> -d <dir> --extract   # Studio Web から取り出す
//   node tools/agent/to-ir.ts <エージェントのフォルダ> [--out <ir.json>]
// 生成器で作り直せる形にする：デプロイ済みのプロセスの道具は { process, folder }（引数の形は生成のときにテナントから取り直す）、
// 組み込みの道具は { builtin }、ほかの道具・コンテキスト・エスカレーション・ガードレールは raw でそのまま持つ。
// 終了コード: 0 = OK、2 = 使い方の間違い

import { existsSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import type { AgentIR, EvalCase, Field, Guardrail, Tool } from "./gen.ts";

/** uip agent init が作る評価器（生成の先に必ずあるので IR に持たない） */
const DEFAULT_EVALUATORS = new Set(["evaluator-default.json", "evaluator-default-trajectory.json"]);
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

/** 生成器の省略形で書けるガードレールは省略形に、ほかは raw に戻す */
function guardrailToIR(g: any): Guardrail {
  const raw = { raw: g };
  if (g.$guardrailType !== "builtInValidator") return raw;
  const param = (id: string) => (g.validatorParameters ?? []).find((p: any) => p.id === id)?.value;
  const act = g.action?.$actionType;
  if (act !== "block" && act !== "log") return raw;
  if (act === "log" && g.action.severityLevel !== "Warning") return raw;
  const common: Record<string, unknown> = { action: act };
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
  return raw;
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
  // 本文は contentTokens から組み直す（古い形では content が {{Content}}、トークンが input.Content のことがある）
  ir.system = textOf(sys);
  if (!conv) ir.user = textOf(usr);
  const input = toFields(agent.inputSchema, true);
  if (input) ir.input = input;
  if (!conv) { const output = toFields(agent.outputSchema, false); if (output) ir.output = output; }

  // resources/
  const tools: Tool[] = [];
  const others: Record<string, unknown>[] = [];
  const resDir = join(dir, "resources");
  for (const d of existsSync(resDir) ? readdirSync(resDir).sort() : []) {
    const f = join(resDir, d, "resource.json");
    if (!existsSync(f)) continue;
    const r = readJson(f);
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
    } else if (r.$resourceType === "tool") {
      tools.push({ raw: r });
    } else {
      others.push(r);
    }
  }
  if (tools.length) ir.tools = tools;
  if (others.length) ir.resources = others;
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
  for (const f of existsSync(erDir) ? readdirSync(erDir).filter(f => f.endsWith(".json")).sort() : [])
    if (!DEFAULT_EVALUATORS.has(f)) evalFiles[`evaluators/${f}`] = readJson(join(erDir, f));
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
