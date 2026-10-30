// run の窓口（runner.mjs）に verify を頼み、終わるまで待って結果を出す。SSH のセッションから run するときはこれを使う。
//
// 使い方（引数は verify.mjs と同じ）:
//   node tools/verify/queue-run.mjs --name <作業名> <ファイルかフォルダ>...
//
// 作業名には -run を足す。管理者権限のシェルで build した作業用プロジェクトには管理者権限の Helm が残っていて、同じプロジェクトでは run できないため。

import { existsSync, mkdirSync, readFileSync, statSync, writeFileSync, renameSync } from "node:fs";
import { randomUUID } from "node:crypto";
import { join } from "node:path";
import { setTimeout as sleep } from "node:timers/promises";

const queueDir = "C:\\Users\\Public\\uipath-ir-probe.queue";
const alive = join(queueDir, "runner.alive");

const args = process.argv.slice(2);
const n = args.indexOf("--name");
if (n < 0 || !args[n + 1]) { console.error("--name が要る"); process.exit(2); }
if (!args[n + 1].endsWith("-run")) args[n + 1] += "-run";

const runnerUp = () => existsSync(alive) && Date.now() - Number(readFileSync(alive, "utf8")) < 30 * 60 * 1000 && Date.now() - statSync(alive).mtimeMs < 30 * 60 * 1000;
if (!runnerUp()) { console.error("run の窓口（runner.mjs）が動いていない。管理者なしのターミナルで node tools/verify/runner.mjs を起動してもらう"); process.exit(4); }

mkdirSync(queueDir, { recursive: true });
const id = `${Date.now()}-${randomUUID().slice(0, 8)}`;
writeFileSync(join(queueDir, `${id}.tmp`), JSON.stringify({ cwd: process.cwd(), args }));
renameSync(join(queueDir, `${id}.tmp`), join(queueDir, `${id}.job`));

const done = join(queueDir, `${id}.done`);
while (!existsSync(done)) await sleep(2000);
const r = JSON.parse(readFileSync(done, "utf8"));
process.stdout.write(r.stdout);
process.stderr.write(r.stderr);
process.exit(r.status);
