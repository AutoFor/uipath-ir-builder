// コンパイル済みの .flow をテナントでデバッグ実行し、ノードごとの結果を表にする。
// uip maestro flow debug は Studio Web にソリューションを上げて動かす（テナントに試しのソリューションが 1 つ増える）。
//
// 使い方:
//   node tools/maestro/debug.mjs <file.flow | file.bpmn | caseplan.json> [--automate] [-i '<入力の JSON>'] [--attachment <入力名>=<ファイル>]... [--timeout <秒>] [--json] [--profile <名前>]
//     --profile   uip login --profile で作ったログイン（別の組織・テナント）で動かす
//     --automate  Maestro Automate のプロジェクト（operate.json の profile が Lite）で動かす
//   caseplan.json は verify.mjs --out の <dir>/<名前>.case/caseplan.json（横の bindings_v2.json も写す）
//   .bpmn は init の雛形に入れたあと bpmn refresh で entry-points.json を作り直してから debug する（--automate は Flow だけ）
//   .bpmn は debug の後で debug-instance variables / incidents も読み、ノードの出力・プロセスの変数・失敗の理由を出す
//   caseplan.json には -i / --attachment を渡せない（uip maestro case debug に入力のオプションが無い）
//   .flow は tools/maestro/verify.mjs --out <dir> が <dir>/<名前>.flow/<名前>.flow に書く
// 終了コード: 0 = Completed、1 = それ以外、2 = 使い方の間違い

import { spawnSync } from "node:child_process";
import { copyFileSync, cpSync, existsSync, mkdtempSync, readdirSync, statSync } from "node:fs";
import { tmpdir } from "node:os";
import { basename, dirname, join, resolve } from "node:path";

const uipJs = process.env.UIP_CLI_JS ?? join(process.env.APPDATA ?? "", "npm", "node_modules", "@uipath", "cli", "dist", "index.js");

/** debug の結果（Data）から、ノードごとの状態と出力を取り出す */
// flow debug は camelCase、bpmn debug は PascalCase（FinalStatus、ElementExecutions）で返す。BPMN の結果には変数が無い
export function summarize(data) {
  const outs = new Map((data?.variables?.elements ?? []).map((e) => [e.elementId, e.outputs]));
  return {
    status: data?.finalStatus ?? data?.FinalStatus ?? "unknown",
    nodes: (data?.elementExecutions ?? data?.ElementExecutions ?? []).map((e) => {
      const id = e.elementId ?? e.ElementId;
      return { id, type: e.elementType ?? e.ElementType, status: e.status ?? e.Status, output: outs.get(id) ?? null };
    }),
  };
}

/**
 * BPMN の debug の結果には変数が無いので、debug-instance variables / incidents（どちらも PascalCase）で足す。
 * - ノードの出力：Elements[].Outputs（キーは CLI が先頭を大文字にしたもの。Response.Level など）
 * - プロセスの変数：Globals。キーは GlobalDefinitions の Name（宣言した名前）に戻す
 * - 失敗：incidents の ElementId・ErrorCode・ErrorMessage・ErrorDetails（スクリプトが投げた文は ErrorDetails に入る）
 */
export function addInstanceDetails(s, vars, incidents) {
  const outs = new Map((vars?.Elements ?? []).filter((e) => e.Outputs && Object.keys(e.Outputs).length).map((e) => [e.ElementId, e.Outputs]));
  const defs = vars?.GlobalDefinitions ?? {};
  const globals = vars?.Globals ? Object.fromEntries(Object.entries(vars.Globals).map(([k, v]) => [defs[k]?.Name ?? k, v])) : undefined;
  return {
    ...s,
    nodes: s.nodes.map((n) => ({ ...n, output: n.output ?? outs.get(n.id) ?? null })),
    ...(globals ? { variables: globals } : {}),
    ...(incidents?.length ? { incidents: incidents.map((i) => ({ element: i.ElementId, code: i.ErrorCode, message: i.ErrorMessage, detail: i.ErrorDetails })) } : {}),
  };
}

function main() {
  const argv = process.argv.slice(2);
  const opt = { automate: false, inputs: undefined, timeout: 600, json: false, attachments: [], profile: undefined };
  const files = [];
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--automate") opt.automate = true;
    else if (a === "-i" || a === "--inputs") opt.inputs = argv[++i];
    else if (a === "--timeout") opt.timeout = Number(argv[++i]);
    else if (a === "--json") opt.json = true;
    else if (a === "--attachment") opt.attachments.push(argv[++i]);
    else if (a === "--profile") opt.profile = argv[++i];
    else files.push(a);
  }
  const family = files[0]?.endsWith(".bpmn") ? "bpmn" : basename(files[0] ?? "") === "caseplan.json" ? "case" : "flow";
  if (files.length !== 1 || !/(\.(flow|bpmn)|caseplan\.json)$/.test(files[0]) || !existsSync(files[0])) {
    console.error("使い方: node tools/maestro/debug.mjs <file.flow | file.bpmn | caseplan.json> [--automate] [-i '<JSON>'] [--timeout <秒>] [--json]");
    process.exit(2);
  }
  // uip 1.204 の case debug は入力を受けない（-i も --inputs も無い）。渡すと ValidationError で何も動かない
  if (family === "case" && (opt.inputs || opt.attachments.length)) {
    console.error("Case の debug には入力（-i / --attachment）を渡せない（uip maestro case debug に入力のオプションが無い）。入力の要らない形で流すか、デプロイして uip or jobs start --input-arguments で動かす");
    process.exit(2);
  }
  // Case は verify.mjs --out の <dir>/<名前>.case/caseplan.json。名前はフォルダから取る
  const base = family === "case" ? basename(dirname(resolve(files[0]))).replace(/\.case$/, "") : basename(files[0]).replace(/\.(flow|bpmn)$/, "");
  const name = base.replace(/[^A-Za-z0-9_]/g, "") || "Flow";
  const work = mkdtempSync(join(tmpdir(), "maestro-debug-"));
  const run = (args) => spawnSync(process.execPath, [uipJs, ...args, "--output", "json", ...(opt.profile ? ["--profile", opt.profile] : [])], { cwd: work, encoding: "utf8", maxBuffer: 64 << 20, timeout: (opt.timeout + 120) * 1000 });
  const init = run(["maestro", family, "init", name, ...(opt.automate && family === "flow" ? ["--automate"] : [])]);
  if (init.status !== 0) { console.error(init.stdout || init.stderr); process.exit(1); }
  const project = join(work, `${name}Solution`, name);
  copyFileSync(resolve(files[0]), join(project, family === "case" ? "caseplan.json" : `${name}.${family}`));
  // compile が .flow の横に書く付属のフォルダ（flow の中のエージェントの <id>/agent.json など）も写す。無いと実行で Package resolution failed
  const src = dirname(resolve(files[0]));
  if (family === "case" && existsSync(join(src, "bindings_v2.json"))) copyFileSync(join(src, "bindings_v2.json"), join(project, "bindings_v2.json"));
  // Case の QuickForm（case-quickform.mjs）のフォームの定義 <タスク>.hitl.json も写す
  if (family === "case") for (const e of readdirSync(src)) if (e.endsWith(".hitl.json")) copyFileSync(join(src, e), join(project, e));
  for (const e of readdirSync(src)) if (!/^(pack|node_modules)$/.test(e) && statSync(join(src, e)).isDirectory()) cpSync(join(src, e), join(project, e), { recursive: true });
  if (family === "bpmn") { const rf = run(["maestro", "bpmn", "refresh", project]); if (rf.status !== 0) { console.error(rf.stdout || rf.stderr); process.exit(1); } }
  const r = run(["maestro", family, "debug", project, ...(family === "flow" ? ["--timeout", String(opt.timeout)] : []), ...(opt.inputs ? ["-i", opt.inputs] : []), ...opt.attachments.flatMap((x) => { const [k, ...v] = x.split("="); return ["--attachment", `${k}=${resolve(v.join("="))}`]; })]);
  let env;
  // case debug は JSON の前にログの行を出すので、最初の "{" の行から読む
  const out = r.stdout.slice(Math.max(0, r.stdout.search(/^\{/m)));
  try { env = JSON.parse(out); } catch { console.error(r.stdout || r.stderr); process.exit(1); }
  if (env.Result !== "Success" && !env.Data) { console.error(`${env.Result}: ${env.Message ?? ""} ${env.Instructions ?? ""}`); process.exit(1); }
  let s = summarize(env.Data);
  // BPMN は変数と失敗の理由を別のコマンドで読む（AUT-1211）。Flow は debug の結果に変数があり、失敗は Message に出る
  const instanceId = env.Data?.instanceId ?? env.Data?.InstanceId;
  if (family === "bpmn" && instanceId) {
    const read = (sub) => { const x = run(["maestro", "bpmn", "debug-instance", sub, instanceId]); try { return JSON.parse(x.stdout).Data; } catch { return undefined; } };
    s = addInstanceDetails(s, read("variables"), s.status === "Completed" ? [] : read("incidents"));
  }
  if (opt.json) console.log(JSON.stringify({ ...s, instanceId, studioWebUrl: env.Data?.studioWebUrl ?? env.Data?.StudioWebUrl }, null, 2));
  else {
    console.log(`${s.status}  ${files[0]}${opt.automate ? "（Automate）" : ""}`);
    for (const n of s.nodes) console.log(`  ${n.status.padEnd(10)} ${n.id.padEnd(16)} ${n.type ?? ""}  ${n.output ? JSON.stringify(n.output).slice(0, 120) : ""}`);
    if (s.variables) console.log(`  変数 ${JSON.stringify(s.variables).slice(0, 300)}`);
    for (const i of s.incidents ?? []) console.log(`  incident ${i.element}  ${i.code} ${i.message}：${String(i.detail ?? "").slice(0, 300)}`);
    if (env.Result !== "Success" || s.status !== "Completed") console.log(`  instance ${env.Data?.instanceId ?? env.Data?.InstanceId ?? "?"}  ${env.Message ?? ""} ${env.Instructions ?? ""}`);
  }
  process.exit(s.status === "Completed" ? 0 : 1);
}

if (process.argv[1] && resolve(process.argv[1]).endsWith("debug.mjs")) main();
