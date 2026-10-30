// 試作：1つの「プロセス IR」（JSON）から、Maestro の Flow と BPMN を作る。調査用で、本番の生成器ではない（docs/feasibility-action-center-maestro.md）。
//
// 使い方:
//   node tools/maestro/gen.ts <ir.json> --out <dir>            … <名前>.flow.ts と <名前>.bpmn.ts（公式 SDK のソース）を書く
//   node tools/maestro/gen.ts <ir.json> --out <dir> --direct   … SDK を使わず <名前>.direct.bpmn（XML）を書く（script と start/end だけ）
//
// できあがりの検証は tools/maestro/check.mjs（compile → uip の validate）。
//
// XAML 用の IR（tools/ir/types.ts）は流用していない。XAML の IR は木（Sequence の入れ子）で、式は VB、部品はカタログの DLL の型。
// こちらは工程の並びと分岐で、式は JavaScript、部品はレジストリのノード。共通に使えるのは「AI は JSON だけを書き、機械が生成して検証する」という考え方。

import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { basename, join } from "node:path";

type Ref = { input: string } | { field: [string, string] }; // プロセスの入力か、人の入力欄（[ステップ, 欄]）
type Field = { id: string; label?: string; type: string; direction: "input" | "output"; value?: Ref };
type Step =
  | { kind: "script"; id: string; flow: string; bpmn: string } // 式の言語が違うので両方書く（XAML の IR の { vb, cs } と同じ考え方）
  | { kind: "human"; id: string; title: string; fields: Field[]; outcomes: string[] }
  | { kind: "decide"; id: string; on: string; equals: string; then: Step[]; else: Step[] };
type Ir = { process: string; inputs?: { name: string; type: string }[]; steps: Step[] };

const q = (s: string) => JSON.stringify(s);
const pad = (n: number) => "  ".repeat(n);

// ---- Flow（SDK のソース）----
function flowRef(r: Ref): string {
  return "input" in r ? `input(${q(r.input)})` : `out(${q(r.field[0])}, ${q(r.field[1])})`;
}
function flowSteps(steps: Step[], b: string, depth: number): string[] {
  const out: string[] = [];
  for (const s of steps) {
    if (s.kind === "script") out.push(`${pad(depth)}${b}.step(${q(s.id)}, script({ code: ${q(s.flow)} }))`);
    else if (s.kind === "human") {
      const fields = s.fields.map((f) => `{ id: ${q(f.id)}, label: ${q(f.label ?? f.id)}, type: ${q(f.type)}, direction: ${q(f.direction)}${f.value ? `, value: ${flowRef(f.value)}` : ""} }`);
      out.push(`${pad(depth)}${b}.step(${q(s.id)}, hitl({ variant: "quick-form", title: ${q(s.title)}, fields: [${fields.join(", ")}], outcomes: ${JSON.stringify(s.outcomes)} }))`);
    } else {
      out.push(`${pad(depth)}${b}.branch(${q(s.id)}, js\`$vars.${s.on}.output.Action === ${q(s.equals)}\`, (t) => {`);
      out.push(...flowSteps(s.then, "t", depth + 1).map((l) => l + ";"));
      out.push(`${pad(depth)}}, (e) => {`);
      out.push(...flowSteps(s.else, "e", depth + 1).map((l) => l + ";"));
      out.push(`${pad(depth)}})`);
    }
  }
  return out;
}
export function emitFlow(ir: Ir): string {
  const inputs = (ir.inputs ?? []).map((i) => `${i.name}: types.${i.type}`).join(", ");
  const body = flowSteps(ir.steps, "", 1);
  return [
    `import { flow, script, hitl, input, out, js, types } from "@uipath/maestro-builder-sdk";`,
    ``,
    `export default flow(${q(ir.process)})`,
    `  .name(${q(ir.process)})`,
    ...(inputs ? [`  .input({ ${inputs} })`] : []),
    ...body,
    `  .build();`,
    ``,
  ].join("\n");
}

// ---- BPMN（SDK のソース）----
// グラフに直す。XAML の IR と同じく入れ子で書けるのは IR の側だけで、BPMN は要素と線を別々に並べる
function bpmnRef(r: Ref): string {
  return "input" in r ? `=vars.${r.input}` : `=vars.${r.field[1]}`;
}
export function emitBpmn(ir: Ir): string {
  const nodes: string[] = [];
  const flows: string[] = [];
  const vars: string[] = (ir.inputs ?? []).map((i) => `  .input(${q(i.name)}, ${q(i.type)})`);
  let ends = 0;
  // from は、前のノードと、そこから出る線の追加オプション（条件）
  type From = { id: string; opts?: string };
  const link = (from: From[], to: string) => { for (const f of from) flows.push(`  .sequenceFlow(${q(f.id)}, ${q(to)}${f.opts ? `, ${f.opts}` : ""})`); };
  const walk = (steps: Step[], from: From[]): From[] => {
    for (const s of steps) {
      if (s.kind === "script") {
        nodes.push(`  .scriptTask(${q(s.id)}, { script: ${q(s.bpmn)} })`);
        link(from, s.id);
        from = [{ id: s.id }];
      } else if (s.kind === "human") {
        const decision = `${s.id}Decision`;
        vars.push(`  .var(${q(decision)}, "string")`);
        for (const f of s.fields) if (f.direction === "output") vars.push(`  .var(${q(f.id)}, ${q(f.type)})`);
        const fields = s.fields.map((f) => f.direction === "input"
          ? `{ id: ${q(f.id)}, label: ${q(f.label ?? f.id)}, type: ${q(f.type)}, direction: "input", value: ${q(bpmnRef(f.value!))} }`
          : `{ id: ${q(f.id)}, label: ${q(f.label ?? f.id)}, type: ${q(f.type)}, direction: "output" }`);
        nodes.push(`  .humanTask(${q(s.id)}, { title: ${q(s.title)}, form: { fields: [${fields.join(", ")}], outcomes: ${JSON.stringify(s.outcomes)} }, outputs: { ${decision}: "=Action" } })`);
        link(from, s.id);
        from = [{ id: s.id }];
      } else {
        const elseFlow = `${s.id}_else`;
        nodes.push(`  .exclusiveGateway(${q(s.id)}, { default: ${q(elseFlow)} })`);
        link(from, s.id);
        const a = walk(s.then, [{ id: s.id, opts: `{ condition: ${q(`=vars.${s.on}Decision == ${q(s.equals)}`)} }` }]);
        const b = walk(s.else, [{ id: s.id, opts: `{ id: ${q(elseFlow)} }` }]);
        from = [...a, ...b];
      }
    }
    return from;
  };
  const last = walk(ir.steps, [{ id: "start" }]);
  for (const f of last) {
    const id = `end${++ends}`;
    nodes.push(`  .endEvent(${q(id)})`);
    link([f], id);
  }
  return [
    `import { bpmn } from "@uipath/maestro-builder-sdk/bpmn";`,
    ``,
    `export default bpmn(${q(ir.process)})`,
    `  .name(${q(ir.process)})`,
    ...vars,
    `  .startEvent("start")`,
    ...nodes,
    ...flows,
    `  .build();`,
    ``,
  ].join("\n");
}

// ---- BPMN（SDK なしで XML を直接書く。script だけ）----
// 図（bpmndi）は書かない。uip maestro bpmn format が作る
export function emitBpmnDirect(ir: Ir): string {
  const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/"/g, "&quot;");
  const ids = ["start", ...ir.steps.map((s) => s.id), "end"];
  const flowId = (i: number) => `Flow_${i}`;
  const body = ir.steps.map((s, i) => {
    if (s.kind !== "script") throw new Error(`--direct は script だけ（${s.kind}）`);
    return `    <bpmn:scriptTask id="${esc(s.id)}" name="${esc(s.id)}" scriptFormat="JavaScript">
      <bpmn:extensionElements><uipath:scriptVersion value="v3" /></bpmn:extensionElements>
      <bpmn:incoming>${flowId(i)}</bpmn:incoming><bpmn:outgoing>${flowId(i + 1)}</bpmn:outgoing>
      <bpmn:script><![CDATA[${s.bpmn}]]></bpmn:script>
    </bpmn:scriptTask>`;
  });
  const seq = ids.slice(0, -1).map((id, i) => `    <bpmn:sequenceFlow id="${flowId(i)}" sourceRef="${esc(id)}" targetRef="${esc(ids[i + 1])}" />`);
  return `<?xml version="1.0" encoding="UTF-8"?>
<bpmn:definitions xmlns:bpmn="http://www.omg.org/spec/BPMN/20100524/MODEL" xmlns:bpmndi="http://www.omg.org/spec/BPMN/20100524/DI" xmlns:dc="http://www.omg.org/spec/DD/20100524/DC" xmlns:di="http://www.omg.org/spec/DD/20100524/DI" xmlns:uipath="http://uipath.org/schema/bpmn" id="Definitions_1" targetNamespace="http://bpmn.io/schema/bpmn" exporter="uipath-ir-builder" exporterVersion="0.1">
  <bpmn:process id="${esc(ir.process)}" name="${esc(ir.process)}" isExecutable="true">
    <bpmn:startEvent id="start" name="Start"><bpmn:outgoing>${flowId(0)}</bpmn:outgoing></bpmn:startEvent>
${body.join("\n")}
    <bpmn:endEvent id="end" name="End"><bpmn:incoming>${flowId(ir.steps.length)}</bpmn:incoming></bpmn:endEvent>
${seq.join("\n")}
  </bpmn:process>
  <bpmndi:BPMNDiagram id="Diagram_1"><bpmndi:BPMNPlane id="Plane_1" bpmnElement="${esc(ir.process)}" /></bpmndi:BPMNDiagram>
</bpmn:definitions>
`;
}

// ---- コマンド ----
if (process.argv[1] && basename(process.argv[1]) === "gen.ts") {
  const args = process.argv.slice(2);
  const outIdx = args.indexOf("--out");
  const direct = args.includes("--direct");
  const file = args.find((a, i) => !a.startsWith("--") && i !== outIdx + 1);
  if (!file || outIdx < 0) { console.error("使い方: node tools/maestro/gen.ts <ir.json> --out <dir> [--direct]"); process.exit(2); }
  const out = args[outIdx + 1];
  const ir: Ir = JSON.parse(readFileSync(file, "utf8"));
  mkdirSync(out, { recursive: true });
  const write = (name: string, text: string) => { writeFileSync(join(out, name), text, "utf8"); console.log(`OK ${join(out, name)}`); };
  if (direct) write(`${ir.process}.direct.bpmn`, emitBpmnDirect(ir));
  else {
    write(`${ir.process}.flow.ts`, emitFlow(ir));
    write(`${ir.process}.bpmn.ts`, emitBpmn(ir));
  }
}
