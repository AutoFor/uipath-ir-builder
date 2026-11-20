// 窓口（queue-run.mjs）でワークフローを流し、その結果を Test Manager の手動の実行として書き込む（AUT-1214）。
// ロボットのつなぎ先（Orchestrator）に関係なく、DESKTOP のロボットで流した結果を Test Manager に残すためのもの。
//
// 使い方:
//   テストセットをまとめて流す（1 つの実行に、テストケースごとの記録を書く）:
//     node tools/verify/tm-run.mjs --suite samples/pw/ircu.suite.json [--only IRCU:1,IRCU:3]
//   1 つだけ流す:
//     node tools/verify/tm-run.mjs --test-set IRCU:2 --test-case IRCU:1 [--expect <ログの行>]... -- <queue-run.mjs の引数>
//
// suite（JSON）:
//   { "testSet": "IRCU:2", "profile": "trial",
//     "cases": [ { "testCase": "IRCU:1", "expect": ["請求書のプロジェクト: ixp_trial_invoices"], "queue": ["--name", "pwixp-run", "--template", "<P>", "--use-project", "--no-coded", "<P>/Main.xaml"] } ] }
//   cleanup（省略できる）：流した結果によらず、そのあとに動かす後始末（node で動かすスクリプトと引数。パスはリポジトリの根元から）。
//     作ったものを消すのに使う。終了コードが 0 でなければ、そのケースは Failed。出力は result.txt に入る。例 "cleanup": ["samples/pw/memory/cleanup.ts"]
//
// 流れ（どの段で落ちても、Test Manager に記録が残るようにする）:
//   1. uip tm testsets run --execution-type manual で、手動の実行を作る（ロボットのジョブは動かない）
//   2. テストケースごとに uip tm testcaselog start → queue-run.mjs で流す → 合否を決める → uip tm testcaselog finish
//      合否：queue-run が OK で、expect の行がすべてロボットのログ（out/verify/<名前>/report.json の run.logs）にあれば Passed。
//      それ以外は Failed ＋ has-error
//   3. result.txt（合否の理由とロボットのログ）と report.md を、テストケースの記録に添付する
// uip tm は Cloud の API なので SSH から動かしてよい。uip rpa は使わない（流すのは窓口）。
// 「実行した人」は、Test Manager がサインインしているアカウントにする（--executed-by の値は使われなかった）。
// 手順ごとの記録（--step-logs）は、テストケースに手動の手順（testStepId）が要るので使わない。
import { spawnSync } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..");
const uipJs = process.env.UIP_CLI_JS ?? join(process.env.APPDATA ?? "", "npm", "node_modules", "@uipath", "cli", "dist", "index.js");
const EXECUTED_BY = "DESKTOP の窓口（queue-run）";

// ---- 引数 ----
const argv = process.argv.slice(2);
const sep = argv.indexOf("--");
const own = sep >= 0 ? argv.slice(0, sep) : argv;
const opt = { suite: "", only: [], testSet: "", testCase: "", expect: [], profile: "trial" };
for (let i = 0; i < own.length; i++) {
  const a = own[i];
  if (a === "--suite") opt.suite = own[++i];
  else if (a === "--only") opt.only = own[++i].split(",");
  else if (a === "--test-set") opt.testSet = own[++i];
  else if (a === "--test-case") opt.testCase = own[++i];
  else if (a === "--expect") opt.expect.push(own[++i]);
  else if (a === "--profile") opt.profile = own[++i];
  else { console.error(`知らない引数: ${a}`); process.exit(2); }
}
let suite;
if (opt.suite) {
  suite = JSON.parse(readFileSync(opt.suite, "utf8"));
  if (opt.only.length) suite.cases = suite.cases.filter((c) => opt.only.includes(c.testCase));
  opt.profile = suite.profile ?? opt.profile;
} else if (opt.testSet && opt.testCase && sep >= 0) {
  suite = { testSet: opt.testSet, cases: [{ testCase: opt.testCase, expect: opt.expect, queue: argv.slice(sep + 1) }] };
} else {
  console.error("使い方: node tools/verify/tm-run.mjs --suite <suite.json> [--only <キー>,…]\n      | node tools/verify/tm-run.mjs --test-set <キー> --test-case <キー> [--expect <ログの行>]... -- <queue-run.mjs の引数>");
  process.exit(2);
}
const projectKey = suite.testSet.split(":")[0];

// uip tm を呼び、JSON の Data を返す（stderr の「Resolved project …」などは読まない）
function tm(...args) {
  const r = spawnSync(process.execPath, [uipJs, "tm", ...args, "--profile", opt.profile, "--output", "json"], { encoding: "utf8", maxBuffer: 16 << 20, timeout: 180000 });
  let j;
  try { j = JSON.parse(r.stdout); } catch { throw new Error(`uip tm ${args.slice(0, 2).join(" ")} の出力を読めない: ${(r.stdout || r.stderr).slice(0, 300)}`); }
  if (j.Result !== "Success") throw new Error(`uip tm ${args.slice(0, 2).join(" ")}: ${j.Message ?? JSON.stringify(j).slice(0, 300)}`);
  return j.Data;
}

// テストケースのキー → Id
const all = tm("testcases", "list", "--project-key", projectKey);
const idOf = new Map((all.items ?? all).map((t) => [t.TestCaseKey, t.Id]));
for (const c of suite.cases) if (!idOf.has(c.testCase)) { console.error(`テストケース ${c.testCase} が ${projectKey} に無い`); process.exit(2); }

// 1. 手動の実行
const exe = tm("testsets", "run", "--test-set-key", suite.testSet, "--execution-type", "manual");
const executionId = exe.ExecutionId ?? exe.Id;
console.log(`Test Manager：実行 ${executionId}（${suite.testSet}、${suite.cases.length} 件）`);

const tmp = mkdtempSync(join(tmpdir(), "tm-run-"));
const results = [];
for (const c of suite.cases) {
  const tcId = idOf.get(c.testCase);
  const log = tm("testcaselog", "start", "--project-key", projectKey, "--execution-id", executionId, "--test-case-id", tcId);
  const ni = c.queue.indexOf("--name");
  let runName = ni >= 0 ? c.queue[ni + 1] : "";
  if (runName && !runName.endsWith("-run")) runName += "-run";

  // 2. 窓口で流す
  const startedAt = Date.now();
  const q = spawnSync(process.execPath, [join(root, "tools", "verify", "queue-run.mjs"), ...c.queue], { cwd: root, encoding: "utf8", maxBuffer: 64 << 20 });
  const reportDir = join(root, "out", "verify", runName);
  const reportJson = join(reportDir, "report.json");
  const problems = [];
  const logs = [];
  if (q.status !== 0) problems.push(`queue-run の終了コード ${q.status}${q.stderr ? `（${q.stderr.trim().split("\n").pop()?.slice(0, 200)}）` : ""}`);
  if (!runName || !existsSync(reportJson)) problems.push(`${reportJson} が無い`);
  else {
    const rep = JSON.parse(readFileSync(reportJson, "utf8"));
    if (Date.parse(rep.startedAt) < startedAt - 60000) problems.push("report.json が前の回のもの（今回の結果が無い）");
    if (!rep.ok) problems.push("verify の結果が NG");
    for (const f of rep.files ?? []) {
      logs.push(...(f.run?.logs ?? []));
      if (f.status !== "OK") problems.push(`${f.workflow}: ${f.status}${f.run?.error ? `（${String(f.run.error).slice(0, 200)}）` : ""}`);
    }
  }
  for (const e of c.expect ?? []) if (!logs.some((l) => l.includes(e))) problems.push(`ログに「${e}」が無い`);
  // 後始末（流した結果によらず動かす）。作ったものを消すのに使う
  const cleanupOut = [];
  if (c.cleanup?.length) {
    const cl = spawnSync(process.execPath, c.cleanup.map((a, i) => (i === 0 ? join(root, a) : a)), { cwd: root, encoding: "utf8", maxBuffer: 16 << 20, timeout: 600000 });
    cleanupOut.push(...`${cl.stdout ?? ""}${cl.stderr ?? ""}`.trim().split("\n").filter(Boolean));
    if (cl.status !== 0) problems.push(`後始末の終了コード ${cl.status}（${cleanupOut.at(-1) ?? ""}）`);
  }
  const passed = problems.length === 0;

  // 3. 書いて、添付する
  tm("testcaselog", "finish", "--project-key", projectKey, "--execution-id", executionId, "--test-case-id", tcId,
    "--result", passed ? "Passed" : "Failed", "--has-error", passed ? "false" : "true", "--executed-by", EXECUTED_BY);
  const summary = join(tmp, `result-${c.testCase.replace(/\W/g, "_")}.txt`);
  writeFileSync(summary, [`${c.testCase}: ${passed ? "Passed" : "Failed"}`, ...problems.map((p) => `- ${p}`), "", "ロボットのログ:", ...logs, ...(cleanupOut.length ? ["", "後始末:", ...cleanupOut] : [])].join("\n") + "\n");
  for (const f of [summary, join(reportDir, "report.md")].filter(existsSync)) {
    try { tm("attachment", "upload", "--object-id", log.Id, "--object-type", "testCaseLog", "--project-key", projectKey, "--file", f); }
    catch (e) { console.error(`注意：添付できなかった ${f}: ${e.message}`); }
  }
  results.push({ testCase: c.testCase, passed, problems });
  console.log(`  ${c.testCase} ${passed ? "Passed" : "Failed"}${problems.length ? `：${problems.join("、")}` : ""}`);
}
const failed = results.filter((r) => !r.passed).length;
console.log(`Test Manager に書いた：${results.length - failed} 件 Passed、${failed} 件 Failed（実行 ${executionId}）`);
process.exit(failed ? 1 : 0);
