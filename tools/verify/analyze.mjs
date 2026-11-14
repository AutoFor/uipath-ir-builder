// uipcli（UiPath.CLI.Windows）の package analyze で、生成したプロジェクトを build の前に確かめる。
//   - 中で UiPath.WorkflowCompiler の validate が動き、式のコンパイルまでする（未定義の変数 BC30451 などを出す）
//   - Studio の UiPath.Studio.CommandLine analyze は式を見ない（knowledge/studio-extract-form-data.md）ので、こちらを使う
//   - ロボットを使わないので SSH から動く（queue-run は要らない）。1 プロジェクト数秒
//   - analyze はプロジェクトに .local などを書くので、写しで流す（元のフォルダは触らない）
//   - verify.mjs も build / run の前にこれを流す（--no-analyze で止める）
// 使い方:
//   node tools/verify/analyze.mjs <プロジェクトのフォルダ> [--rules] [--keep]
//     --rules  ワークフロー アナライザーの規則の指摘（警告）も全部出す（既定は件数だけ）
//     --keep   写しと結果の JSON を消さずに残す
// 終了コード: 0 = エラーなし、1 = エラーあり（コンパイル・XAML の読み込み）、2 = 使い方の間違い・uipcli が無い・結果が無い
// uipcli の場所：環境変数 UIPCLI、無ければ %USERPROFILE%\.dotnet\tools\uipcli.exe
//   入れ方：dotnet tool install --global UiPath.CLI.Windows（knowledge/uipath-clis.md）

import { spawnSync } from "node:child_process";
import { cpSync, existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { homedir, tmpdir } from "node:os";
import { basename, join, resolve } from "node:path";

/** analyze の結果（--resultPath の JSON）を、エラーと規則の指摘に分ける。エラーは ErrorCode が "ERROR" のもの */
export function summarize(results) {
  const errors = [], rules = [];
  for (const r of results ?? []) {
    const item = { code: r.ErrorCode, file: r.FilePath ? basename(r.FilePath) : (r.WorkflowDisplayName ?? ""), activity: r.ActivityDisplayName ?? "", message: r.Description };
    (r.ErrorCode === "ERROR" ? errors : rules).push(item);
  }
  return { errors, rules };
}

// 写さないもの：analyze・build が作るもの（古いと pack・analyze が落ちる。.local の CodedWorkflow.cs など）
const SKIP = new Set([".local", ".codedworkflows", ".git", "node_modules"]);

export const uipcliPath = () => process.env.UIPCLI ?? join(homedir(), ".dotnet", "tools", "uipcli.exe");

/**
 * プロジェクトを写して uipcli package analyze を流す。
 * 返り値：{ errors, rules, seconds, work } か、uipcli が無いとき { missing }、結果が無いとき { fatal, seconds, work }
 * keep が false なら写しを消す（work は消した場所）
 */
export function analyzeProject(project, { keep = false } = {}) {
  const uipcli = uipcliPath();
  if (!existsSync(uipcli)) return { missing: `uipcli が無い（${uipcli}）。dotnet tool install --global UiPath.CLI.Windows で入れる` };
  const t0 = Date.now();
  const work = mkdtempSync(join(tmpdir(), "ir-analyze-"));
  const copy = join(work, basename(project));
  cpSync(project, copy, { recursive: true, filter: (src) => !SKIP.has(basename(src)) });
  const resultPath = join(work, "result.json");
  const r = spawnSync(uipcli, ["package", "analyze", join(copy, "project.json"), "--resultPath", resultPath, "--analyzerTraceLevel", "Warning"], { encoding: "utf8", maxBuffer: 64 << 20, timeout: 600000 });
  const seconds = Math.round((Date.now() - t0) / 1000);
  let out;
  if (!existsSync(resultPath)) {
    const lines = `${r.stdout ?? ""}${r.stderr ?? ""}`.split(/\r?\n/).filter((l) => /\[Error\]|Exception|error/i.test(l)).slice(0, 20);
    out = { fatal: [`結果が無い（uipcli の終了コード ${r.status}）`, ...lines].join("\n"), seconds, work };
  } else out = { ...summarize(JSON.parse(readFileSync(resultPath, "utf8"))), seconds, work };
  if (!keep) rmSync(work, { recursive: true, force: true });
  return out;
}

function main() {
  const args = process.argv.slice(2);
  const dir = args.find((a) => !a.startsWith("--"));
  if (!dir) { console.error("使い方: node tools/verify/analyze.mjs <プロジェクトのフォルダ> [--rules] [--keep]"); process.exit(2); }
  const project = resolve(dir);
  if (!existsSync(join(project, "project.json"))) { console.error(`${project} に project.json が無い`); process.exit(2); }
  const keep = args.includes("--keep");
  const a = analyzeProject(project, { keep });
  if (a.missing) { console.error(a.missing); process.exit(2); }
  if (a.fatal) { console.error(a.fatal); process.exit(2); }
  const { errors, rules, work } = a;
  for (const e of errors) console.log(`[ERROR] ${e.file}${e.activity ? ` / ${e.activity}` : ""}: ${e.message}`);
  if (args.includes("--rules")) for (const w of rules) console.log(`[rule ] ${w.code} ${w.file}: ${w.message}`);
  console.log(`エラー ${errors.length} 件、規則の指摘 ${rules.length} 件${args.includes("--rules") ? "" : "（--rules で表示）"}`);
  if (keep) console.log(`写しと結果：${work}`);
  process.exit(errors.length ? 1 : 0);
}

if (process.argv[1] && resolve(process.argv[1]).endsWith("analyze.mjs")) main();
