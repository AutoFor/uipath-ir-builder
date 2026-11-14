// API ワークフロー（Studio Web の「API workflow」、CNCF Serverless Workflow DSL 1.0.0 に UiPath の拡張）の生成器。
// AI は小さな IR を書き、生成器が Workflow.json を作る。手で書くと落ちる所（Studio Web が保存で壊す形）をここで決まった形にする：
//   - 活動のキー（Assign_1、If_1#Wrapper など）を通し番号で振る。キーはワークフロー全体で重ならない
//   - export の形（変数は variables、ほかは outputs。ループの本体は結果を集める形）
//   - 文字列のリテラルは ${'…'} で包む（素の "abc" は Studio Web が ${abc} にして ReferenceError になる）
//   - Assign は 1 つに 1 変数（複数は Studio Web が 1 つに減らす）
//   - If は #Wrapper / #Then / #Else、ループは #Body。分岐とループの本体は then: "exit"
//   - Response は ${{ … }} の 1 つの式（オブジェクトに ${} を並べる形は Studio Web が壊す）
//   - Break は break: "true"（文字列）、set を付けない
// 形の出典：uipath-api-workflow スキルの references/task-types.md と、uip api-workflow init の雛形。knowledge/api-workflow.md
//
// 使い方:
//   node tools/apiwf/gen.ts <ir.json> --project <uip api-workflow init で作ったフォルダ>   # <project>/Workflow.json と entry-points.json を書く
//   node tools/apiwf/gen.ts <ir.json> --print                                              # Workflow.json を表示
// 終了コード: 0 = OK、1 = IR の誤り、2 = 使い方の間違い

import { spawnSync } from "node:child_process";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";

export type Lit = { lit: string };
export type Val = string | number | boolean | null | Lit | Val[] | { [k: string]: Val };
type SchemaType = string | Record<string, unknown>;

export type Step =
  | ({ assign: string; value: Val } & Common)
  | ({ js: string } & Common)
  | ({ if: string; then?: Step[]; else?: Step[] } & Common)
  | ({ forEach: string; item?: string; index?: string; body: Step[] } & Common)
  | ({ doWhile: string; body: Step[] } & Common)
  | ({ break: true } & Common)
  | ({ try: Step[]; catch?: Step[]; as?: string } & Common)
  | ({ wait: { minutes?: number; seconds?: number; milliseconds?: number } } & Common)
  | ({ response: Val; failed?: boolean } & Common)
  | ({ fileToBase64: string } & Common)
  | ({ base64ToFile: string; fileName?: Val; mimeType?: Val } & Common)
  | ({ sequence: Step[] } & Common)
  | ({ raw: Record<string, unknown> } & Common)
  | ({ stub: string; inputs?: Record<string, Val>; connection?: string; objectName?: string } & Common);

/** registry stub の結果（uip api-workflow registry stub の Data） */
export type StubResult = { SlotKey: string; ExportBucketKey: string; Kind?: string; Activity: Record<string, unknown> };
/** stub を作る関数（CLI を呼ぶ。テストでは差し替える） */
export type Stubber = (typeId: string, opts: { inputs: Record<string, unknown>; connection?: string; objectName?: string; instance: number }) => StubResult;

type Common = { id?: string; name?: string };

export type Ir = {
  name?: string;
  inputs?: Record<string, SchemaType>;
  outputs?: Record<string, SchemaType>;
  variables?: Record<string, SchemaType | { type: string; default?: unknown }>;
  body: Step[];
};

export type Issue = { path: string; code: string; message: string };

const ARGS = '${{ "$context": $context, "$workflow": $workflow, "$input": $input }}';
const VARS_EXPORT = "{ ...$context, variables: { ...$context.variables, ...$output } }";
const outExport = (key: string) => `{ ...$context, outputs: { ...$context?.outputs, "${key}": $output } }`;
const forEachBody = (key: string, index: string) =>
  `{ ...$context, outputs: { ...$context?.outputs, "${key}": { ...$context?.outputs?.${key}, results: [ ...($${index} == 0 ? [] : ($context?.outputs?.${key}?.results ?? [])), ...([$output] ?? []) ] } } }`;
const doWhileBody = (key: string) =>
  `{ ...$context, outputs: { ...$context?.outputs, "${key}": { ...$context?.outputs?.${key}, results: [ ...($context?.outputs?.${key}?.results ?? []), ...([$output] ?? []) ] } } }`;
const WORKFLOW_START = {
  WorkflowStart: {
    set: "${ { ...Object.entries($workflow.definition?.document?.metadata?.variables?.schema?.document?.properties || {}).reduce((acc, [name, def]) => ({ ...acc, [name]: def?.default }), {}), ...($workflow.input || {}) } }",
    output: { as: "${$input}" },
    export: { as: VARS_EXPORT },
    metadata: { activityType: "Assign", displayName: "Workflow start", fullName: "Assign", isTransparent: true },
  },
};

// IR の型名 → JSON Schema。file は JobAttachment の参照（#/definitions/job-attachment。スキルの file-base64-roundtrip-example と同じ形）
const JOB_ATTACHMENT = {
  type: "object",
  properties: { ID: { type: "string", description: "Orchestrator attachment key" }, FullName: { type: "string" }, MimeType: { type: "string" }, Metadata: { type: "object" } },
  required: ["ID"],
  "x-uipath-resource-kind": "JobAttachment",
};
function schemaOf(t: SchemaType | { type: string; default?: unknown }): Record<string, unknown> {
  if (typeof t === "string") return t === "file" ? { $ref: "#/definitions/job-attachment" } : { type: t };
  return { ...t };
}
const objSchema = (props: Record<string, SchemaType> | undefined, title: string) => {
  const properties = Object.fromEntries(Object.entries(props ?? {}).map(([k, v]) => [k, schemaOf(v)]));
  const hasFile = Object.values(props ?? {}).includes("file");
  return { schema: { format: "json", document: { type: "object", properties, title, ...(hasFile ? { definitions: { "job-attachment": JOB_ATTACHMENT } } : {}) } } };
};

const isLit = (v: unknown): v is Lit => typeof v === "object" && v !== null && !Array.isArray(v) && Object.keys(v).length === 1 && "lit" in v;
const jsStr = (s: string) => `'${s.replace(/\\/g, "\\\\").replace(/'/g, "\\'").replace(/\r/g, "\\r").replace(/\n/g, "\\n")}'`;

/** IR の値 → JS の式（${} の中身）。文字列は式、{ lit } は文字列リテラル、数・真偽・null・配列・オブジェクトはその値 */
export function jsExpr(v: Val, refs: (s: string) => string): string {
  if (isLit(v)) return jsStr(v.lit);
  if (typeof v === "string") return refs(v);
  if (v === null || typeof v === "number" || typeof v === "boolean") return JSON.stringify(v);
  if (Array.isArray(v)) return `[${v.map((x) => jsExpr(x, refs)).join(", ")}]`;
  return `{ ${Object.entries(v).map(([k, x]) => `${/^[A-Za-z_$][\w$]*$/.test(k) ? k : JSON.stringify(k)}: ${jsExpr(x, refs)}`).join(", ")} }`;
}

/** コネクタの入力の値：リテラルは素のまま（${'…'} にすると Studio Web が保存で消す）、式は ${…} */
export function connectorValue(v: Val, refs: (s: string) => string): unknown {
  if (isLit(v)) return v.lit;
  if (typeof v === "string") return `\${${refs(v)}}`;
  if (v === null || typeof v === "number" || typeof v === "boolean") return v;
  if (Array.isArray(v)) return v.map((x) => connectorValue(x, refs));
  return Object.fromEntries(Object.entries(v).map(([k, x]) => [k, connectorValue(x, refs)]));
}

/** Assign の値：数・真偽はそのまま、ほかは ${…} */
function assignValue(v: Val, refs: (s: string) => string): unknown {
  if (typeof v === "number" || typeof v === "boolean") return v;
  return `\${${jsExpr(v, refs)}}`;
}

const KIND_PREFIX: Record<string, string> = {
  assign: "Assign", js: "Javascript", if: "If", forEach: "For_Each", doWhile: "Do_While", break: "Break", try: "Try_Catch",
  wait: "Wait", response: "Response", fileToBase64: "FileToBase64", base64ToFile: "Base64ToFile", sequence: "Sequence",
};
const KINDS = [...Object.keys(KIND_PREFIX), "raw", "stub"];
const kindOf = (s: Step): string | undefined => KINDS.find((k) => k in s);

export function generate(ir: Ir, projectId?: string, stubber?: Stubber): { workflow: Record<string, unknown>; issues: Issue[] } {
  const issues: Issue[] = [];
  const add = (path: string, code: string, message: string) => issues.push({ path, code, message });
  const counters = new Map<string, number>();
  const used = new Set<string>(["Sequence_1", "WorkflowStart"]);
  counters.set("Sequence", 1);
  const ids = new Map<string, string>(); // IR の id → 活動のキー

  // 1 回目：キーを振る（後ろの活動を @id で前から指せるように、先に全部決める）
  const keyOf = new Map<Step, string>();
  const stubs = new Map<Step, StubResult>();
  const stubCount = new Map<string, number>();
  const bucketOf = new Map<string, string>(); // 活動のキー → $context.outputs のキー（stub は SlotKey と違うことがある）
  const assignKeys = (steps: Step[], path: string) => steps.forEach((s, i) => {
    const p = `${path}[${i}]`;
    const kind = kindOf(s);
    if (!kind) { add(p, "UNKNOWN_STEP", `手順の種類が分からない（${KINDS.join(" / ")} のどれかを書く）`); return; }
    let key: string;
    if (kind === "raw") {
      const keys = Object.keys((s as { raw: Record<string, unknown> }).raw);
      if (keys.length !== 1) { add(p, "BAD_RAW", "raw は { \"<キー>\": { … } } の 1 つだけ"); return; }
      key = keys[0];
    } else if (kind === "stub") {
      const st = s as { stub: string; inputs?: Record<string, Val>; connection?: string; objectName?: string };
      if (!stubber) { add(p, "NO_STUBBER", "stub は CLI（uip api-workflow registry stub）で作る。gen.ts をコマンドで動かす"); return; }
      const n = (stubCount.get(st.stub) ?? 0) + 1;
      stubCount.set(st.stub, n);
      // inputs の値は後で式を入れ替えるので、ここでは目印のまま渡す
      const inputs = Object.fromEntries(Object.entries(st.inputs ?? {}).map(([k, v]) => [k, connectorValue(v, (e) => e)]));
      let r: StubResult;
      try { r = stubber(st.stub, { inputs, connection: st.connection, objectName: st.objectName, instance: n }); }
      catch (e) { add(p, "STUB_FAILED", String((e as Error).message)); return; }
      stubs.set(s, r);
      key = r.SlotKey;
      bucketOf.set(key, r.ExportBucketKey);
    } else {
      const pre = KIND_PREFIX[kind];
      do { const n = (counters.get(pre) ?? 0) + 1; counters.set(pre, n); key = `${pre}_${n}`; } while (used.has(key));
    }
    if (used.has(key)) add(p, "DUP_KEY", `キー ${key} が重なる`);
    used.add(key);
    keyOf.set(s, key);
    if (s.id) { if (ids.has(s.id)) add(p, "DUP_ID", `id "${s.id}" が重なる`); ids.set(s.id, bucketOf.get(key) ?? key); }
    const c = s as Record<string, unknown>;
    for (const sub of ["then", "else", "body", "try", "catch", "sequence"]) if (Array.isArray(c[sub])) assignKeys(c[sub] as Step[], `${p}.${sub}`);
  });
  assignKeys(ir.body, "body");

  // @id → $context.outputs.<キー>（@id.x も可）
  const refs = (path: string) => (e: string) => e.replace(/@([A-Za-z_][\w]*)/g, (m, id) => {
    const k = ids.get(id);
    if (!k) { add(path, "UNKNOWN_REF", `@${id} の手順が無い`); return m; }
    return `$context.outputs.${k}`;
  });

  const declaredVars = new Set(Object.keys(ir.variables ?? {}));
  const build = (steps: Step[], path: string, loop: { depth: number; names: Set<string> }): Record<string, unknown>[] =>
    steps.flatMap((s, i) => {
      const p = `${path}[${i}]`;
      const kind = kindOf(s);
      const key = keyOf.get(s);
      if (!kind || !key) return [];
      const R = refs(p);
      const meta = (activityType: string, displayName: string, extra: Record<string, unknown> = {}) =>
        ({ activityType, displayName: s.name ?? displayName, fullName: activityType, ...extra });
      switch (kind) {
        case "assign": {
          const a = s as { assign: string; value: Val };
          if (typeof a.assign !== "string" || !a.assign) { add(p, "BAD_ASSIGN", "assign は変数の名前 1 つ"); return []; }
          if (!declaredVars.has(a.assign)) add(p, "UNDECLARED_VAR", `変数 ${a.assign} が variables に無い`);
          return [{ [key]: { set: { [a.assign]: assignValue(a.value, R) }, export: { as: VARS_EXPORT }, metadata: meta("Assign", "Assign", { isTransparent: false }) } }];
        }
        case "js": {
          const code = R((s as { js: string }).js);
          if (!/\b(return|throw)\b/.test(code)) add(p, "JS_NO_RETURN", "JavaScript は return で値を返す（throw だけでもよい）");
          return [{ [key]: { run: { script: { code, language: "javascript", arguments: ARGS } }, export: { as: outExport(key) }, metadata: meta("JsInvoke", "JavaScript") } }];
        }
        case "if": {
          const f = s as { if: string; then?: Step[]; else?: Step[] };
          return [{ [`${key}#Wrapper`]: {
            do: [
              { [key]: { switch: [{ case: { when: `\${${R(f.if)}}`, then: `${key}#Then` } }, { default: { then: `${key}#Else` } }], metadata: { displayName: "If" } } },
              { [`${key}#Then`]: { do: build(f.then ?? [], `${p}.then`, loop), then: "exit" } },
              { [`${key}#Else`]: { do: build(f.else ?? [], `${p}.else`, loop), then: "exit" } },
            ],
            export: { as: outExport(key) },
            metadata: meta("If", "If"),
          } }];
        }
        case "forEach": {
          const f = s as { forEach: string; item?: string; index?: string; body: Step[] };
          const item = f.item ?? (loop.depth ? `currentItem${loop.depth + 1}` : "currentItem");
          const index = f.index ?? `${item}Index`;
          for (const n of [item, index]) {
            if (!/^[A-Za-z_]\w*$/.test(n)) add(p, "BAD_NAME", `ループの名前 "${n}" は英数字（$ は付けない。式では $${n} と書く）`);
            if (loop.names.has(n)) add(p, "SHADOWED_LOOP_NAME", `外のループと同じ名前 "${n}"（内側は別の名前にする）`);
          }
          const names = new Set([...loop.names, item, index]);
          return [{ [key]: {
            for: { each: item, in: `\${${R(f.forEach)}}`, at: index },
            do: [{ [`${key}#Body`]: { do: build(f.body ?? [], `${p}.body`, { depth: loop.depth + 1, names }), export: { as: forEachBody(key, index) } } }],
            output: { as: `\${$context.outputs.${key}}` },
            metadata: meta("ForEach", "For Each"),
          } }];
        }
        case "doWhile": {
          const f = s as { doWhile: string; body: Step[] };
          return [{ [key]: {
            for: { in: "${ [1] }" },
            doWhile: `\${${R(f.doWhile)}}`,
            do: [{ [`${key}#Body`]: { do: build(f.body ?? [], `${p}.body`, { depth: loop.depth + 1, names: loop.names }), export: { as: doWhileBody(key) } } }],
            output: { as: `\${$context.outputs.${key}}` },
            metadata: meta("DoWhile", "Do While"),
          } }];
        }
        case "break":
          if (!loop.depth) add(p, "BREAK_OUTSIDE_LOOP", "Break はループ（forEach / doWhile）の本体の中だけ");
          return [{ [key]: { break: "true", then: "exit", metadata: meta("Break", "Break") } }];
        case "try": {
          const t = s as { try: Step[]; catch?: Step[]; as?: string };
          return [{ [key]: {
            try: build(t.try ?? [], `${p}.try`, loop),
            catch: { as: t.as ?? "error", do: build(t.catch ?? [], `${p}.catch`, loop) },
            export: { as: outExport(key) },
            metadata: meta("TryCatch", "Try Catch"),
          } }];
        }
        case "wait": {
          const w = (s as { wait: { minutes?: number; seconds?: number; milliseconds?: number } }).wait;
          return [{ [key]: { wait: { minutes: w.minutes ?? 0, seconds: w.seconds ?? 0, milliseconds: w.milliseconds ?? 0 }, export: { as: outExport(key) }, metadata: meta("Wait", "Wait") } }];
        }
        case "response": {
          const r = s as { response: Val; failed?: boolean };
          const v = r.response;
          const isObj = typeof v === "object" && v !== null && !Array.isArray(v) && !isLit(v);
          const body = isObj ? `\${{ ${jsExpr(v, R).slice(2, -2)} }}` : `\${${jsExpr(v, R)}}`;
          return [{ [key]: { response: body, markJobAsFailed: r.failed ?? false, then: "end", export: { as: outExport(key) }, metadata: meta("Response", "Response") } }];
        }
        case "fileToBase64": {
          const code = `return { output: await $helpers.file.fileToBase64(${R((s as { fileToBase64: string }).fileToBase64)}) }`;
          return [{ [key]: { run: { script: { code, language: "javascript", arguments: ARGS } }, export: { as: outExport(key) }, metadata: meta("FileToBase64", "File to Base64", { icon: "sw:convert-file-to-base64" }) } }];
        }
        case "base64ToFile": {
          const b = s as { base64ToFile: string; fileName?: Val; mimeType?: Val };
          const opts = [`base64: ${R(b.base64ToFile)}`];
          if (b.fileName !== undefined) opts.push(`fileName: ${jsExpr(b.fileName, R)}`);
          if (b.mimeType !== undefined) opts.push(`mimeType: ${jsExpr(b.mimeType, R)}`);
          const code = `return { output: await $helpers.file.base64ToFile({ ${opts.join(", ")} }) }`;
          return [{ [key]: { run: { script: { code, language: "javascript", arguments: ARGS } }, export: { as: outExport(key) }, metadata: meta("Base64ToFile", "Base64 to File", { icon: "sw:convert-base64-to-file" }) } }];
        }
        case "sequence":
          return [{ [key]: { do: build((s as { sequence: Step[] }).sequence, `${p}.sequence`, loop), metadata: meta("Sequence", "Sequence") } }];
        case "raw":
          // 手で用意した活動をそのまま入れる。式の @id だけ置き換える
          return [JSON.parse(R(JSON.stringify((s as { raw: Record<string, unknown> }).raw)))];
        case "stub": {
          // registry stub の活動。inputs の式（@id）を置き換え、表示名を付ける
          const st = s as { stub: string; inputs?: Record<string, Val> };
          const r = stubs.get(s)!;
          const act = JSON.parse(JSON.stringify(r.Activity)) as Record<string, any>;
          const body = act[key];
          const w = body?.with ?? {};
          for (const [k, v] of Object.entries(st.inputs ?? {})) {
            const val = connectorValue(v, R);
            for (const slot of ["bodyParameters", "queryParameters", "pathParameters", "multipartParameters"]) if (w[slot] && k in w[slot]) w[slot][k] = val;
          }
          if (s.name && body?.metadata) body.metadata.displayName = s.name;
          return [act];
        }
      }
      return [];
    });

  const userSteps = build(ir.body, "body", { depth: 0, names: new Set() });
  const variables = Object.fromEntries(Object.entries(ir.variables ?? {}).map(([k, v]) => [k, schemaOf(v as SchemaType)]));
  const workflow: Record<string, unknown> = {
    document: {
      dsl: "1.0.0",
      name: ir.name ?? "Workflow",
      ...(projectId ? { tags: { projectId } } : {}),
      version: "0.0.1",
      namespace: "default",
      metadata: { variables: { schema: { format: "json", document: { type: "object", title: "Variables", properties: variables } } } },
    },
    ...(ir.inputs ? { input: objSchema(ir.inputs, "Inputs") } : {}),
    ...(ir.outputs ? { output: objSchema(ir.outputs, "Outputs") } : {}),
    do: [{ Sequence_1: { do: [WORKFLOW_START, ...userSteps], metadata: { activityType: "Sequence", displayName: "Sequence", fullName: "Sequence" } } }],
    evaluate: { mode: "strict", language: "javascript" },
  };
  return { workflow, issues };
}

/** entry-points.json の input / output を、ワークフローのスキーマに合わせる（Studio Web が引数を出すため） */
export function entryPoints(ep: Record<string, any>, wf: Record<string, any>): Record<string, any> {
  const first = ep.entryPoints?.[0];
  if (!first) return ep;
  return { ...ep, entryPoints: [{ ...first, input: wf.input?.schema?.document ?? null, output: wf.output?.schema?.document ?? null }, ...ep.entryPoints.slice(1)] };
}

/** uip api-workflow registry stub を呼ぶ stubber */
export function cliStubber(profile?: string): Stubber {
  const uip = process.env.UIP_CLI_JS ?? join(process.env.APPDATA ?? "", "npm", "node_modules", "@uipath", "cli", "dist", "index.js");
  return (typeId, o) => {
    const args = [uip, "api-workflow", "registry", "stub", typeId, "--instance", String(o.instance), "--output", "json"];
    if (Object.keys(o.inputs).length) args.push("--inputs", JSON.stringify(o.inputs));
    if (o.connection) args.push("--connection-id", o.connection);
    if (o.objectName) args.push("--object-name", o.objectName);
    if (profile) args.push("--profile", profile);
    const r = spawnSync(process.execPath, args, { encoding: "utf8", maxBuffer: 64 << 20 });
    const j = JSON.parse(r.stdout.slice(r.stdout.indexOf("{")));
    if (j.Result !== "Success") throw new Error(`registry stub ${typeId}: ${j.Message ?? r.stderr}`);
    return j.Data as StubResult;
  };
}

function main() {
  const args = process.argv.slice(2);
  const take = (f: string) => { const i = args.indexOf(f); if (i < 0) return undefined; const v = args[i + 1]; args.splice(i, 2); return v; };
  const project = take("--project");
  const print = args.includes("--print");
  const file = args.find((a) => !a.startsWith("--"));
  if (!file || (!project && !print)) {
    console.error("使い方: node tools/apiwf/gen.ts <ir.json> --project <api-workflow のプロジェクト> | --print");
    process.exit(2);
  }
  const ir: Ir = JSON.parse(readFileSync(file, "utf8").replace(/^﻿/, ""));
  let projectId: string | undefined;
  const wfPath = project ? join(resolve(project), "Workflow.json") : undefined;
  if (wfPath && existsSync(wfPath)) projectId = JSON.parse(readFileSync(wfPath, "utf8")).document?.tags?.projectId;
  const profile = take("--profile");
  const { workflow, issues } = generate(ir, projectId, cliStubber(profile));
  if (issues.length) {
    console.error(`NG ${file}`);
    for (const i of issues) console.error(`  ${i.code.padEnd(20)} ${i.path}: ${i.message}`);
    process.exit(1);
  }
  const text = JSON.stringify(workflow, null, 2) + "\n";
  if (print) process.stdout.write(text);
  if (project) {
    writeFileSync(wfPath!, text);
    const epPath = join(resolve(project), "entry-points.json");
    if (existsSync(epPath)) writeFileSync(epPath, JSON.stringify(entryPoints(JSON.parse(readFileSync(epPath, "utf8")), workflow), null, 2) + "\n");
    console.log(`OK ${file} -> ${wfPath}`);
  }
}

if (process.argv[1] && /gen\.ts$/.test(process.argv[1]) && process.argv[1].includes("apiwf")) main();
