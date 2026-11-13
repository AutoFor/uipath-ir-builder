// コンパイル済みの .flow をテナントでデバッグ実行し、ノードごとの結果を表にする。
// uip maestro flow debug は Studio Web にソリューションを上げて動かす（テナントに試しのソリューションが 1 つ増える）。
//
// 使い方:
//   node tools/maestro/debug.mjs <file.flow | file.bpmn> [--automate] [-i '<入力の JSON>'] [--timeout <秒>] [--json]
//     --automate  Maestro Automate のプロジェクト（operate.json の profile が Lite）で動かす
//   .bpmn は init の雛形に入れたあと bpmn refresh で entry-points.json を作り直してから debug する（--automate は Flow だけ）
//   .flow は tools/maestro/verify.mjs --out <dir> が <dir>/<名前>.flow/<名前>.flow に書く
// 終了コード: 0 = Completed、1 = それ以外、2 = 使い方の間違い

import { spawnSync } from "node:child_process";
import { copyFileSync, existsSync, mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { basename, join, resolve } from "node:path";

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
  const opt = { automate: false, inputs: undefined, timeout: 600, json: false };
  const files = [];
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--automate") opt.automate = true;
    else if (a === "-i" || a === "--inputs") opt.inputs = argv[++i];
    else if (a === "--timeout") opt.timeout = Number(argv[++i]);
    else if (a === "--json") opt.json = true;
    else files.push(a);
  }
  const family = files[0]?.endsWith(".bpmn") ? "bpmn" : "flow";
  if (files.length !== 1 || !/\.(flow|bpmn)$/.test(files[0]) || !existsSync(files[0])) {
    console.error("使い方: node tools/maestro/debug.mjs <file.flow | file.bpmn> [--automate] [-i '<JSON>'] [--timeout <秒>] [--json]");
    process.exit(2);
  }
  const name = basename(files[0]).replace(/\.(flow|bpmn)$/, "").replace(/[^A-Za-z0-9_]/g, "") || "Flow";
  const work = mkdtempSync(join(tmpdir(), "maestro-debug-"));
  const run = (args) => spawnSync(process.execPath, [uipJs, ...args, "--output", "json"], { cwd: work, encoding: "utf8", maxBuffer: 64 << 20, timeout: (opt.timeout + 120) * 1000 });
  const init = run(["maestro", family, "init", name, ...(opt.automate && family === "flow" ? ["--automate"] : [])]);
  if (init.status !== 0) { console.error(init.stdout || init.stderr); process.exit(1); }
  const project = join(work, `${name}Solution`, name);
  copyFileSync(resolve(files[0]), join(project, `${name}.${family}`));
  if (family === "bpmn") { const rf = run(["maestro", "bpmn", "refresh", project]); if (rf.status !== 0) { console.error(rf.stdout || rf.stderr); process.exit(1); } }
  const r = run(["maestro", family, "debug", project, ...(family === "flow" ? ["--timeout", String(opt.timeout)] : []), ...(opt.inputs ? ["-i", opt.inputs] : [])]);
  let env;
  try { env = JSON.parse(r.stdout); } catch { console.error(r.stdout || r.stderr); process.exit(1); }
  const s = summarize(env.Data);
  if (opt.json) console.log(JSON.stringify({ ...s, studioWebUrl: env.Data?.studioWebUrl ?? env.Data?.StudioWebUrl }, null, 2));
  else {
    console.log(`${s.status}  ${files[0]}${opt.automate ? "（Automate）" : ""}`);
    for (const n of s.nodes) console.log(`  ${n.status.padEnd(10)} ${n.id.padEnd(16)} ${n.type ?? ""}  ${n.output ? JSON.stringify(n.output).slice(0, 120) : ""}`);
    if (env.Result !== "Success") console.log(`  ${env.Message ?? ""} ${env.Instructions ?? ""}`);
  }
  process.exit(s.status === "Completed" ? 0 : 1);
}

if (process.argv[1] && resolve(process.argv[1]).endsWith("debug.mjs")) main();
