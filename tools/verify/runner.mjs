// run の窓口。RDP / コンソールの「管理者なし」のターミナルで動かしておくと、キューの依頼を順番に verify.mjs で流す。
// SSH のセッションは管理者権限（High）・セッション 0 になり、そこから起動した Helm ではロボットに実行を頼めないため。
//
// 使い方（管理者なしのターミナルで。Ctrl+C で止める）:
//   node tools/verify/runner.mjs
//
// 依頼する側は tools/verify/queue-run.mjs を使う。

import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, readdirSync, renameSync, unlinkSync, writeFileSync } from "node:fs";
import { dirname, join, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { setTimeout as sleep } from "node:timers/promises";

export const queueDir = "C:\\Users\\Public\\uipath-ir-probe.queue";

const repo = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..");
// 依頼の cwd は、このリポジトリか、その worktree のフォルダだけ受ける（そこの verify.mjs を実行するため）
const allowed = [repo, `${repo}-wt`];
const isAllowed = (cwd) => allowed.some((a) => cwd === a || cwd.startsWith(a + sep));

function runJob(file) {
  const path = join(queueDir, file);
  const running = path.replace(/\.job$/, ".running");
  renameSync(path, running);
  const id = file.replace(/\.job$/, "");
  const job = JSON.parse(readFileSync(running, "utf8"));
  const cwd = resolve(job.cwd);
  let result;
  if (!isAllowed(cwd)) result = { status: 2, stdout: "", stderr: `cwd が許可された場所にない: ${cwd}` };
  else {
    console.log(`[${new Date().toLocaleTimeString()}] ${id}: ${job.args.join(" ")}`);
    const r = spawnSync(process.execPath, [join(cwd, "tools", "verify", "verify.mjs"), ...job.args], { cwd, encoding: "utf8", maxBuffer: 256 * 1024 * 1024, env: { ...process.env, UIP_RUN_LOCK: join(queueDir, "run.lock") } });
    result = { status: r.status ?? 1, stdout: r.stdout ?? "", stderr: (r.stderr ?? "") + (r.error ? String(r.error) : "") };
    console.log(`[${new Date().toLocaleTimeString()}] ${id}: 終了コード ${result.status}`);
  }
  writeFileSync(join(queueDir, `${id}.tmp`), JSON.stringify(result));
  renameSync(join(queueDir, `${id}.tmp`), join(queueDir, `${id}.done`));
  renameSync(running, join(queueDir, `${id}.taken`));
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  mkdirSync(queueDir, { recursive: true });
  // 前回の途中で止まった依頼は、やり直さず失敗として返す
  for (const f of readdirSync(queueDir).filter((f) => f.endsWith(".running"))) {
    const id = f.replace(/\.running$/, "");
    writeFileSync(join(queueDir, `${id}.done`), JSON.stringify({ status: 3, stdout: "", stderr: "runner が途中で止まった" }));
    renameSync(join(queueDir, f), join(queueDir, `${id}.taken`));
  }
  // 走っている worktree の verify.mjs は古いことがあるので、ロックは確実に書けるキューのフォルダに置く（上の env）
  try { writeFileSync("C:/Users/Public/uipath-ir-probe.run.lock", "x", { flag: "wx" }); unlinkSync("C:/Users/Public/uipath-ir-probe.run.lock"); } catch (e) { console.log(`参考: 既定のロックの場所には書けない: ${e.message}`); }
  console.log(`run の窓口を開始しました（${queueDir}）。閉じるまで依頼を順番に流します。`);
  for (;;) {
    writeFileSync(join(queueDir, "runner.alive"), String(Date.now()));
    const next = readdirSync(queueDir).filter((f) => f.endsWith(".job")).sort()[0];
    if (next && existsSync(join(queueDir, next))) runJob(next);
    else await sleep(2000);
  }
}
