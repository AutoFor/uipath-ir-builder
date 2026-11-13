// コンパイル済みの .flow をテナントでデバッグ実行し、ノードごとの結果を表にする。
// uip maestro flow debug は Studio Web にソリューションを上げて動かす（テナントに試しのソリューションが 1 つ増える）。
//
// 使い方:
//   node tools/maestro/debug.mjs <file.flow | file.bpmn | caseplan.json> [--automate] [-i '<入力の JSON>'] [--attachment <入力名>=<ファイル>]... [--timeout <秒>] [--json]
//     --automate  Maestro Automate のプロジェクト（operate.json の profile が Lite）で動かす
//   caseplan.json は verify.mjs --out の <dir>/<名前>.case/caseplan.json（横の bindings_v2.json も写す）
//   .bpmn は init の雛形に入れたあと bpmn refresh で entry-points.json を作り直してから debug する（--automate は Flow だけ）
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

function main() {
  const argv = process.argv.slice(2);
  const opt = { automate: false, inputs: undefined, timeout: 600, json: false, attachments: [] };
  const files = [];
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--automate") opt.automate = true;
    else if (a === "-i" || a === "--inputs") opt.inputs = argv[++i];
    else if (a === "--timeout") opt.timeout = Number(argv[++i]);
    else if (a === "--json") opt.json = true;
    else if (a === "--attachment") opt.attachments.push(argv[++i]);
    else files.push(a);
  }
  const family = files[0]?.endsWith(".bpmn") ? "bpmn" : basename(files[0] ?? "") === "caseplan.json" ? "case" : "flow";
  if (files.length !== 1 || !/(\.(flow|bpmn)|caseplan\.json)$/.test(files[0]) || !existsSync(files[0])) {
    console.error("使い方: node tools/maestro/debug.mjs <file.flow | file.bpmn | caseplan.json> [--automate] [-i '<JSON>'] [--timeout <秒>] [--json]");
    process.exit(2);
  }
  // Case は verify.mjs --out の <dir>/<名前>.case/caseplan.json。名前はフォルダから取る
  const base = family === "case" ? basename(dirname(resolve(files[0]))).replace(/\.case$/, "") : basename(files[0]).replace(/\.(flow|bpmn)$/, "");
  const name = base.replace(/[^A-Za-z0-9_]/g, "") || "Flow";
  const work = mkdtempSync(join(tmpdir(), "maestro-debug-"));
  const run = (args) => spawnSync(process.execPath, [uipJs, ...args, "--output", "json"], { cwd: work, encoding: "utf8", maxBuffer: 64 << 20, timeout: (opt.timeout + 120) * 1000 });
  const init = run(["maestro", family, "init", name, ...(opt.automate && family === "flow" ? ["--automate"] : [])]);
  if (init.status !== 0) { console.error(init.stdout || init.stderr); process.exit(1); }
  const project = join(work, `${name}Solution`, name);
  copyFileSync(resolve(files[0]), join(project, family === "case" ? "caseplan.json" : `${name}.${family}`));
  // compile が .flow の横に書く付属のフォルダ（flow の中のエージェントの <id>/agent.json など）も写す。無いと実行で Package resolution failed
  const src = dirname(resolve(files[0]));
  if (family === "case" && existsSync(join(src, "bindings_v2.json"))) copyFileSync(join(src, "bindings_v2.json"), join(project, "bindings_v2.json"));
  for (const e of readdirSync(src)) if (!/^(pack|node_modules)$/.test(e) && statSync(join(src, e)).isDirectory()) cpSync(join(src, e), join(project, e), { recursive: true });
  if (family === "bpmn") { const rf = run(["maestro", "bpmn", "refresh", project]); if (rf.status !== 0) { console.error(rf.stdout || rf.stderr); process.exit(1); } }
  const r = run(["maestro", family, "debug", project, ...(family === "flow" ? ["--timeout", String(opt.timeout)] : []), ...(opt.inputs ? ["-i", opt.inputs] : []), ...opt.attachments.flatMap((x) => { const [k, ...v] = x.split("="); return ["--attachment", `${k}=${resolve(v.join("="))}`]; })]);
  let env;
  // case debug は JSON の前にログの行を出すので、最初の "{" の行から読む
  const out = r.stdout.slice(Math.max(0, r.stdout.search(/^\{/m)));
  try { env = JSON.parse(out); } catch { console.error(r.stdout || r.stderr); process.exit(1); }
  const s = summarize(env.Data);
  if (opt.json) console.log(JSON.stringify({ ...s, instanceId: env.Data?.instanceId ?? env.Data?.InstanceId, studioWebUrl: env.Data?.studioWebUrl ?? env.Data?.StudioWebUrl }, null, 2));
  else {
    console.log(`${s.status}  ${files[0]}${opt.automate ? "（Automate）" : ""}`);
    for (const n of s.nodes) console.log(`  ${n.status.padEnd(10)} ${n.id.padEnd(16)} ${n.type ?? ""}  ${n.output ? JSON.stringify(n.output).slice(0, 120) : ""}`);
    if (env.Result !== "Success" || s.status !== "Completed") console.log(`  instance ${env.Data?.instanceId ?? env.Data?.InstanceId ?? "?"}  ${env.Message ?? ""} ${env.Instructions ?? ""}`);
  }
  process.exit(s.status === "Completed" ? 0 : 1);
}

if (process.argv[1] && resolve(process.argv[1]).endsWith("debug.mjs")) main();
