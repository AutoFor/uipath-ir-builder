// 窓口（queue-run.mjs）でワークフローを流し、その結果を Test Manager の手動の実行として書き込む（AUT-1214）。
// ロボットのつなぎ先（Orchestrator）に関係なく、DESKTOP のロボットで流した結果を Test Manager に残すためのもの。
//
// 使い方:
//   node tools/verify/tm-run.mjs --test-set <セットのキー> --test-case <テストケースのキー> [--expect <ログの行>]... [--profile trial] -- <queue-run.mjs の引数>
//   例: node tools/verify/tm-run.mjs --test-set IRCU:2 --test-case IRCU:1 --expect "請求書のプロジェクト: ixp_trial_invoices" -- \
//         --name pwixp-run --template C:/Users/Public/uipath-cloud-ui/PwIxp --use-project --no-coded C:/Users/Public/uipath-cloud-ui/PwIxp/Main.xaml
//
// 流れ（どの段で落ちても、Test Manager に記録が残るようにする）:
//   1. uip tm testsets run --execution-type manual で、手動の実行を作る（ロボットのジョブは動かない）
//   2. uip tm testcaselog start で、テストケースの記録を始める
//   3. queue-run.mjs で流す（窓口は利用者の画面のセッションで動く）
//   4. 合否：queue-run が OK で、--expect の行がすべてロボットのログにあれば Passed。それ以外は Failed（has-error も付ける）
//   5. uip tm testcaselog finish で結果を書き、result.txt（合否の理由とロボットのログ）と report.md を添付する
// 「実行した人」は、Test Manager がサインインしているアカウントにする（--executed-by の値は使われなかった）
// uip tm は Cloud の API なので SSH から動かしてよい。uip rpa は使わない（流すのは窓口）。
import { spawnSync } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..");
const uipJs = process.env.UIP_CLI_JS ?? join(process.env.APPDATA ?? "", "npm", "node_modules", "@uipath", "cli", "dist", "index.js");

const argv = process.argv.slice(2);
const sep = argv.indexOf("--");
const own = sep >= 0 ? argv.slice(0, sep) : argv;
const queueArgs = sep >= 0 ? argv.slice(sep + 1) : [];
// executedBy：Test Manager の「実行した人」。利用者のメールは送らず、流した場所の名前を書く
const opt = { testSet: "", testCase: "", expect: [], profile: "trial", executedBy: "DESKTOP の窓口（queue-run）" };
for (let i = 0; i < own.length; i++) {
  const a = own[i];
  if (a === "--test-set") opt.testSet = own[++i];
  else if (a === "--test-case") opt.testCase = own[++i];
  else if (a === "--expect") opt.expect.push(own[++i]);
  else if (a === "--profile") opt.profile = own[++i];
  else if (a === "--executed-by") opt.executedBy = own[++i];
  else { console.error(`知らない引数: ${a}`); process.exit(2); }
}
const ni = queueArgs.indexOf("--name");
if (!opt.testSet || !opt.testCase || ni < 0) {
  console.error("使い方: node tools/verify/tm-run.mjs --test-set <キー> --test-case <キー> [--expect <ログの行>]... -- --name <作業名> … <ファイル>");
  process.exit(2);
}
const projectKey = opt.testSet.split(":")[0];
let runName = queueArgs[ni + 1];
if (!runName.endsWith("-run")) runName += "-run";

// uip tm を呼び、JSON の Data を返す（stderr の「Resolved project …」などは読まない）
function tm(...args) {
  const r = spawnSync(process.execPath, [uipJs, "tm", ...args, "--profile", opt.profile, "--output", "json"], { encoding: "utf8", maxBuffer: 16 << 20, timeout: 180000 });
  let j;
  try { j = JSON.parse(r.stdout); } catch { throw new Error(`uip tm ${args.slice(0, 2).join(" ")} の出力を読めない: ${(r.stdout || r.stderr).slice(0, 300)}`); }
  if (j.Result !== "Success") throw new Error(`uip tm ${args.slice(0, 2).join(" ")}: ${j.Message ?? JSON.stringify(j).slice(0, 300)}`);
  return j.Data;
}

// テストケースのキー → Id
const tcs = tm("testcases", "list", "--project-key", projectKey);
const tc = (tcs.items ?? tcs).find((t) => t.TestCaseKey === opt.testCase);
if (!tc) { console.error(`テストケース ${opt.testCase} が ${projectKey} に無い`); process.exit(2); }

// 1. 手動の実行、2. テストケースの記録を始める
const exe = tm("testsets", "run", "--test-set-key", opt.testSet, "--execution-type", "manual");
const executionId = exe.ExecutionId ?? exe.Id;
const log = tm("testcaselog", "start", "--project-key", projectKey, "--execution-id", executionId, "--test-case-id", tc.Id);
console.log(`Test Manager：実行 ${executionId}、テストケースの記録 ${log.Id}`);

// 3. 窓口で流す
const startedAt = Date.now();
const q = spawnSync(process.execPath, [join(root, "tools", "verify", "queue-run.mjs"), ...queueArgs], { cwd: root, encoding: "utf8", maxBuffer: 64 << 20 });
process.stdout.write(q.stdout ?? "");
process.stderr.write(q.stderr ?? "");

// 4. 合否
const reportDir = join(root, "out", "verify", runName);
const reportJson = join(reportDir, "report.json");
const problems = [];
let logs = [];
if (q.status !== 0) problems.push(`queue-run の終了コード ${q.status}`);
if (!existsSync(reportJson)) problems.push(`${reportJson} が無い`);
else {
  const rep = JSON.parse(readFileSync(reportJson, "utf8"));
  // 窓口が前の回の report を残していないか（始めた時刻で確かめる）
  if (Date.parse(rep.startedAt) < startedAt - 60000) problems.push("report.json が前の回のもの（今回の結果が無い）");
  if (!rep.ok) problems.push("verify の結果が NG");
  for (const f of rep.files ?? []) {
    logs.push(...(f.run?.logs ?? []));
    if (f.status !== "OK") problems.push(`${f.workflow}: ${f.status}${f.run?.error ? `（${String(f.run.error).slice(0, 200)}）` : ""}`);
  }
}
for (const e of opt.expect) if (!logs.some((l) => l.includes(e))) problems.push(`ログに「${e}」が無い`);
const passed = problems.length === 0;

// 5. 結果を書き、添付する
// 手順ごとの記録（--step-logs）は、テストケースに手動の手順（testStepId）が要るので使わない。詳しいことは添付の result.txt に書く
const tmp = mkdtempSync(join(tmpdir(), "tm-run-"));
const finished = tm("testcaselog", "finish", "--project-key", projectKey, "--execution-id", executionId, "--test-case-id", tc.Id,
  "--result", passed ? "Passed" : "Failed", "--has-error", passed ? "false" : "true", "--executed-by", opt.executedBy);
const summary = join(tmp, "result.txt");
writeFileSync(summary, [`結果: ${passed ? "Passed" : "Failed"}`, ...problems.map((p) => `- ${p}`), "", "ロボットのログ:", ...logs].join("\n") + "\n");
for (const f of [summary, join(reportDir, "report.md")].filter(existsSync)) {
  try { tm("attachment", "upload", "--object-id", log.Id, "--object-type", "testCaseLog", "--project-key", projectKey, "--file", f); }
  catch (e) { console.error(`注意：添付できなかった ${f}: ${e.message}`); }
}
console.log(`Test Manager に書いた：${opt.testCase} ${finished?.Result ?? (passed ? "Passed" : "Failed")}（実行 ${executionId}）`);
for (const p of problems) console.log(`  - ${p}`);
process.exit(passed ? 0 : 1);
