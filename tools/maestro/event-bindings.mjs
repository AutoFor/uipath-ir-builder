// ソリューションの中の Flow プロジェクトを、コネクタのイベントのトリガーが作られる形に整える。
// .flow だけをプロジェクトに入れると、process の resource の runtimeDependencies が空になり、
// デプロイは通るのにトリガーが作られない（行を足しても起動しない）。また SDK 6.66.5 は where から
// detail.filterExpression も作り、これが残っていると起動しない（knowledge/maestro.md 10 節）。
//
// 使い方:
//   node tools/maestro/event-bindings.mjs <ソリューションの中の Flow プロジェクトのフォルダ>
//   そのあと uip solution resources refresh --solution-folder <ソリューション> → uip solution pack
// やること:
//   1. <名前>.flow のコネクタのトリガーから detail.filterExpression を消す
//   2. uip maestro flow pack で nupkg を作り、content/bindings_v2.json と content/entry-points.json をプロジェクトに写す
//      （bindings_v2.json の EventTrigger の FilterExpression も空にする）
// 終了コード: 0 = OK、1 = 失敗、2 = 使い方の間違い

import { spawnSync } from "node:child_process";
import { existsSync, mkdtempSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { basename, join, resolve } from "node:path";

const uipJs = process.env.UIP_CLI_JS ?? join(process.env.APPDATA ?? "", "npm", "node_modules", "@uipath", "cli", "dist", "index.js");

/** コネクタのイベントのトリガーの filterExpression を消す。消した数を返す */
export function stripEventFilters(flow) {
  let n = 0;
  for (const node of flow.nodes ?? []) {
    const d = node?.inputs?.detail;
    if (/^uipath\.connector\.trigger\./.test(node.type ?? "") && d && "filterExpression" in d) { delete d.filterExpression; n++; }
  }
  return n;
}

/** bindings_v2.json の EventTrigger の FilterExpression を空にする */
export function clearBindingFilters(bindings) {
  for (const r of bindings.resources ?? []) if (r.resource === "EventTrigger" && r.metadata?.FilterExpression) r.metadata.FilterExpression = "";
  return bindings;
}

/** nupkg（zip）から 1 ファイルを読む。zip は work の直下に置く。
 * Windows 標準の tar.exe（bsdtar）は zip を読める。PATH の先にある Git Bash の tar（GNU）は zip を読めないので、フルパスで呼ぶ */
function readFromZip(zip, entry, work) {
  const sysTar = join(process.env.SystemRoot ?? "C:\\Windows", "System32", "tar.exe");
  const r = spawnSync(existsSync(sysTar) ? sysTar : "tar", ["-xf", basename(zip), entry], { cwd: work, encoding: "utf8" });
  if (r.status !== 0) throw new Error(`${entry} を取り出せない: ${r.stderr}`);
  return readFileSync(join(work, entry), "utf8");
}

function main() {
  const dir = process.argv[2] && resolve(process.argv[2]);
  const flowFile = dir && existsSync(dir) ? readdirSync(dir).find((f) => f.endsWith(".flow")) : undefined;
  if (!flowFile) { console.error("使い方: node tools/maestro/event-bindings.mjs <Flow プロジェクトのフォルダ>"); process.exit(2); }
  const flowPath = join(dir, flowFile);
  const flow = JSON.parse(readFileSync(flowPath, "utf8"));
  const stripped = stripEventFilters(flow);
  writeFileSync(flowPath, JSON.stringify(flow, null, 2));
  const work = mkdtempSync(join(tmpdir(), "event-bindings-"));
  const r = spawnSync(process.execPath, [uipJs, "maestro", "flow", "pack", dir, work, "--output", "json"], { encoding: "utf8", maxBuffer: 64 << 20 });
  const nupkg = existsSync(work) ? readdirSync(work).find((f) => f.endsWith(".nupkg")) : undefined;
  if (r.status !== 0 || !nupkg) { console.error(r.stdout || r.stderr); process.exit(1); }
  const bindings = clearBindingFilters(JSON.parse(readFromZip(join(work, nupkg), "content/bindings_v2.json", work)));
  writeFileSync(join(dir, "bindings_v2.json"), JSON.stringify(bindings, null, 2));
  writeFileSync(join(dir, "entry-points.json"), readFromZip(join(work, nupkg), "content/entry-points.json", work));
  const triggers = (bindings.resources ?? []).filter((x) => x.resource === "EventTrigger").length;
  console.log(`OK  ${flowFile}: filterExpression を ${stripped} 個消し、bindings_v2.json（EventTrigger ${triggers} 個）と entry-points.json を置いた`);
  if (triggers === 0) console.log("  注意: EventTrigger がない。コネクタのイベントのトリガーでない Flow かもしれない");
}

if (process.argv[1] && resolve(process.argv[1]).endsWith("event-bindings.mjs")) main();
