// IR（*.json）と Coded（*.cs）をまとめて、作業用の UiPath プロジェクトで build / run して結果を残す。
//
// 使い方:
//   node tools/verify/verify.mjs --name <作業名> <ファイルかフォルダ>... [--build-only] [--fresh]
//
//   --name <n>        作業用プロジェクトは C:\Users\Public\uipath-ir-probe-<n>（英数字・-・_ だけ）
//   --build-only      run せず、uip rpa build だけ
//   --fresh           作業用プロジェクトを作り直す（.local のキャッシュも消える）
//   --template <dir>  テンプレート（既定 C:\Users\Public\uipath-ir-probe）
//   --timeout <秒>    uip 1回あたりの上限（既定 900）
//   --report <dir>    結果の置き場所（既定 out/verify/<n>）
//
//   --no-coded        IR から C# を作らない（XAML だけ）
//   --use-project     作業用プロジェクトの project.json の版のカタログを使う（gen.ts / gen-coded.ts の --project。--template で版を変えたプロジェクトを試すとき）
//   --imports-from <xaml>  ルートの imports をこの XAML から取る（gen.ts の --imports-from）
//
// IR（*.json）1つにつき、XAML（<プロジェクト>/<workflow>.xaml）と C#（<プロジェクト>/coded/<workflow>.cs）の両方を作って試す。
// C# で対応表の無いアクティビティは、gen-coded.ts が <プロジェクト>/coded/_activities/（1つのアクティビティだけ）と coded/_xaml/（部分木）に XAML を書き、RunWorkflow で呼ぶ（knowledge/coded-via-xaml.md）。
// 手書きの *.cs は <プロジェクト>/ にそのまま写して試す。*.xaml も同じ（tools/ir/convert-xaml.ts で C# にした XAML など）。
// 式の言語が C# のテンプレート（--template C:\Users\Public\uipath-ir-probe-cs）では --use-project を付ける。gen.ts が project.json の expressionLanguage に従って C# の XAML を作る。
//
// ファイルの横に置くもの（どれも任意）:
//   <名前>.expected.log  期待するログ。1行1件、この順に出ること（間に別の行があってもよい）。
//                        "[Information] こんにちは" のように [レベル] から書くとレベルも比べる。XAML と C# の両方で比べる
//   <名前>.verify.json   { "args": { "in_Name": "太郎" },       // run の入力引数
//                          "noRun": "Orchestrator が要るため",   // run しない（build だけ）理由
//                          "entryPoint": true,                   // このワークフローを project.json のエントリポイントにする（トリガー用）
//                          "buildAlone": true }                  // --build-only で、このファイルだけを置いて別に build する（Wait 系。AUT-1074）
//
// 入力データ: samples/data/ を <プロジェクト>/data/ に写す（Excel のサンプルは "data\excel\Sample.xlsx" を読み、"output\<名前>.xlsx" に書く）。
//
// 結果: <report>/report.json、<report>/report.md、<report>/logs/*.txt。全部通れば終了コード 0。

import { spawnSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import { cpSync, existsSync, mkdirSync, readFileSync, readdirSync, renameSync, rmSync, statSync, unlinkSync, writeFileSync } from "node:fs";
import { basename, dirname, extname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..");
const uipJs = process.env.UIP_CLI_JS ?? join(process.env.APPDATA ?? "", "npm", "node_modules", "@uipath", "cli", "dist", "index.js");

// ---- 引数 ----
const argv = process.argv.slice(2);
const opt = { name: "", buildOnly: false, fresh: false, noCoded: false, template: "C:\\Users\\Public\\uipath-ir-probe", timeout: 900, report: "" };
const inputs = [];
for (let i = 0; i < argv.length; i++) {
  const a = argv[i];
  if (a === "--name") opt.name = argv[++i];
  else if (a === "--build-only") opt.buildOnly = true;
  else if (a === "--fresh") opt.fresh = true;
  else if (a === "--template") opt.template = argv[++i];
  else if (a === "--timeout") opt.timeout = Number(argv[++i]);
  else if (a === "--report") opt.report = argv[++i];
  else if (a === "--no-coded") opt.noCoded = true;
  else if (a === "--use-project") opt.useProject = true;
  else if (a === "--imports-from") opt.importsFrom = resolve(argv[++i]);
  else if (a === "--default-xaml") opt.defaultXaml = argv[++i];
  else if (a === "--out") opt.out = argv[++i];
  else if (a === "--pack") opt.pack = resolve(argv[++i]); // build-only の後に、作業用プロジェクトを <dir> に .nupkg にする（テナントで確かめるとき）
  else if (a === "--pack-version") opt.packVersion = argv[++i];
  else if (a === "--create-template") opt.createTemplate = argv[++i]; // Studio の空のプロジェクトを <dir> に作る（テンプレート用）
  else if (a === "--expression-language") opt.expressionLanguage = argv[++i];
  else if (a.startsWith("--")) die(`知らないオプション ${a}`);
  else inputs.push(a);
}
if (!/^[A-Za-z0-9_-]+$/.test(opt.name ?? "")) die("--name <作業名> が要る（英数字・-・_ だけ）");
// SSH のセッションは管理者権限・セッション 0。ここで Helm を起動すると、空いた Helm が窓口の run にも割り当てられ、run が「アクセスが拒否されました」で落ちる
if (process.env.SSH_CONNECTION) die("SSH のセッションから直接流さない。node tools/verify/queue-run.mjs で窓口に頼む（build も同じ。引数はそのまま渡せる）");
if (!existsSync(uipJs)) die(`uip が見つからない: ${uipJs}（環境変数 UIP_CLI_JS で指定できる）`);

// --create-template <dir> [--expression-language CSharp]：Studio の BlankTemplate でプロジェクトを作る（uip も Helm を使うので窓口を通す）。
// 依存の版はテンプレートの既定のまま。作ったあと project.json の dependencies を既定の版にそろえる
if (opt.createTemplate) {
  const dir = resolve(opt.createTemplate);
  if (existsSync(dir)) die(`もうある: ${dir}`);
  const r = spawnSync(process.execPath, [uipJs, "rpa", "create-project", "--name", basename(dir), "--location", dirname(dir), "--template-id", "BlankTemplate",
    "--expression-language", opt.expressionLanguage ?? "VisualBasic", "--target-framework", "Windows", "--dotnet-version", "net8.0", "--skip-solution-registration", "--output", "json"],
    { cwd: dirname(dir), encoding: "utf8", maxBuffer: 64 << 20, timeout: opt.timeout * 1000 });
  console.log((r.stdout ?? "").slice(0, 2000) + (r.stderr ?? ""));
  if (!existsSync(join(dir, "project.json"))) die("create-project に失敗");
  console.log(`OK ${dir}`);
  process.exit(0);
}
if (!inputs.length && !opt.defaultXaml) die("検証するファイル（*.json / *.cs）かフォルダを渡す");

const projDir = `${opt.template}-${opt.name}`;
const reportDir = resolve(opt.report || join(root, "out", "verify", opt.name));
const logDir = join(reportDir, "logs");

// 下の build / run より前に定義する（withRunLock から使う）
const runLock = process.env.UIP_RUN_LOCK ?? "C:/Users/Public/uipath-ir-probe.run.lock";

// ---- 入力を集める ----
const files = [];
for (const p of inputs) collect(resolve(p));
const irFiles = files.filter((f) => extname(f) === ".json");
const csFiles = files.filter((f) => extname(f) === ".cs");
if (!files.length && !opt.defaultXaml) die("*.json / *.cs / *.xaml が1つもない");

// ---- 作業用プロジェクトを用意する ----
const lock = join(projDir, ".verify.lock");
prepareProject();
writeFileSync(lock, String(process.pid));
process.on("exit", () => { try { unlinkSync(lock); } catch {} });
rmSync(reportDir, { recursive: true, force: true });
mkdirSync(logDir, { recursive: true });

// --default-xaml <クラス名> --out <ファイル>：Studio の既定 XAML を取って保存する（uip も Helm を使うので窓口を通す）
if (opt.defaultXaml) {
  const r = spawnSync(process.execPath, [uipJs, "rpa", "activities", "get-default-xaml", "--activity-class-name", opt.defaultXaml, "--project-dir", projDir, "--output", "json"], { cwd: projDir, encoding: "utf8", maxBuffer: 64 << 20, timeout: opt.timeout * 1000 });
  const ok = JSON.parse((r.stdout ?? "").slice(Math.max(0, (r.stdout ?? "").search(/^\{/m))) || "{}").Result === "Success";
  if (!ok) die(`get-default-xaml に失敗: ${(r.stdout ?? "").slice(0, 400)}${r.stderr ?? ""}`);
  if (!opt.out) die("--out が要る");
  mkdirSync(dirname(resolve(opt.out)), { recursive: true });
  writeFileSync(resolve(opt.out), r.stdout);
  console.log(`OK ${opt.defaultXaml} -> ${opt.out}`);
  process.exit(0);
}

const results = [];
const t0 = Date.now();

// ---- IR → XAML ----
const irs = irFiles.map((f) => ({ file: f, wf: readJson(f) }));
const names = new Map();
for (const { file, wf } of irs) {
  const n = String(wf.workflow ?? "").toLowerCase();
  if (names.has(n)) die(`ワークフロー名 "${wf.workflow}" が重複: ${rel(names.get(n))} と ${rel(file)}`);
  names.set(n, file);
}
const genArgs = [join(root, "tools", "ir", "gen.ts")];
if (!names.has("main")) genArgs.push(join(root, "tools", "verify", "Main.json")); // project.json の main を満たすための置き物
genArgs.push(...irFiles, "--out", projDir);
if (opt.useProject) genArgs.push("--project", projDir);
if (opt.importsFrom) genArgs.push("--imports-from", opt.importsFrom);
const gen = node(genArgs);
const genLines = gen.stdout.split(/\r?\n/);
for (const { file, wf } of irs) {
  const r = newResult(file, "xaml");
  r.workflow = wf.workflow;
  r.target = join(projDir, `${wf.workflow}.xaml`);
  const i = genLines.findIndex((l) => l === `OK ${file}` || l.startsWith(`OK ${file} ->`) || l === `NG ${file}`);
  if (i < 0) r.gen = { ok: false, issues: ["gen.ts の出力に結果が無い"] };
  else if (genLines[i].startsWith("OK")) r.gen = { ok: true };
  else {
    const issues = [];
    for (let j = i + 1; j < genLines.length && genLines[j].startsWith("  "); j++) issues.push(genLines[j].trim());
    r.gen = { ok: false, issues };
  }
  results.push(r);
}
if (gen.status && gen.status !== 1) writeFileSync(join(logDir, "_gen.txt"), gen.stdout + gen.stderr);

// *.verify.json の "entryPoint": true は、そのワークフローを project.json のエントリポイントにする（トリガーは Main かエントリポイントにしか置けないため）。
// 毎回 Main.xaml だけに戻してから足す
{
  const pjPath = join(projDir, "project.json");
  const pj = readJson(pjPath);
  pj.entryPoints = (pj.entryPoints ?? []).filter((e) => e.filePath === "Main.xaml");
  for (const { file, wf } of irs) {
    if (sidecar(file).entryPoint) pj.entryPoints.push({ filePath: `${wf.workflow}.xaml`, uniqueId: randomUUID(), input: [], output: [] });
  }
  writeFileSync(pjPath, JSON.stringify(pj, null, 2));
}

// ---- IR → C#（coded/ に置く。InvokeWorkflowFile の先も coded/ の .cs にする）----
if (irFiles.length && !opt.noCoded) {
  const cg = node([join(root, "tools", "ir", "gen-coded.ts"), ...irFiles, "--out", join(projDir, "coded"), "--invoke-dir", "coded", ...(opt.useProject ? ["--project", projDir] : [])]);
  const lines = cg.stdout.split(/\r?\n/);
  for (const { file, wf } of irs) {
    const r = newResult(file, "coded-gen");
    r.workflow = wf.workflow;
    r.target = join(projDir, "coded", `${wf.workflow}.cs`);
    const i = lines.findIndex((l) => l.startsWith(`OK ${file} ->`) || l === `NG ${file}` || l.startsWith(`NG ${file}（`) || l === `SKIP ${file}`);
    if (i < 0) r.gen = { ok: false, issues: [`gen-coded.ts の出力に結果が無い: ${(cg.stdout + cg.stderr).trim().slice(0, 300)}`] };
    else if (lines[i].startsWith("OK")) {
      // OK の下の行は注意（CODED_VIA_XAML：対応表の無いアクティビティを XAML 経由で呼ぶ。XAML は coded/_activities/ と coded/_xaml/ に gen-coded.ts が書く）
      const notes = [];
      for (let j = i + 1; j < lines.length && lines[j].startsWith("  "); j++) notes.push(lines[j].trim());
      r.gen = { ok: true, notes };
    } else {
      const issues = [];
      for (let j = i + 1; j < lines.length && lines[j].startsWith("  "); j++) issues.push(lines[j].trim());
      if (lines[i].startsWith("SKIP")) { r.gen = { ok: true }; r.skipped = issues.join("; "); r.target = undefined; }
      else r.gen = { ok: false, issues };
    }
    results.push(r);
  }
}

// ---- Coded：チェッカー → コピー ----
if (csFiles.length) {
  const chk = node([join(root, "tools", "coded", "check.ts"), "--json", "--project", projDir, ...csFiles]);
  let parsed = [];
  try { parsed = JSON.parse(chk.stdout).files; } catch { writeFileSync(join(logDir, "_check.txt"), chk.stdout + chk.stderr); }
  const classes = new Map();
  for (const f of csFiles) {
    const r = newResult(f, "coded");
    const c = parsed.find((x) => resolve(x.file) === f);
    const errors = c ? c.issues.filter((x) => x.severity === "error") : [];
    const warns = c ? c.issues.filter((x) => x.severity === "warning") : [];
    r.check = c ? { ok: errors.length === 0, errors: errors.map(fmtIssue), warnings: warns.map(fmtIssue) } : { ok: false, errors: ["チェッカーが結果を返さなかった"], warnings: [] };
    const dest = join(projDir, basename(f));
    if (classes.has(basename(f).toLowerCase())) die(`同じファイル名の .cs が2つある: ${rel(classes.get(basename(f).toLowerCase()))} と ${rel(f)}`);
    classes.set(basename(f).toLowerCase(), f);
    // チェッカーでエラーの出た .cs は写さない。1つでも壊れた .cs があると、プロジェクト全体のコンパイルが落ちて他も試せなくなる
    if (!r.check.ok) { results.push(r); continue; }
    cpSync(f, dest);
    r.target = dest;
    results.push(r);
  }
}

// ---- 手書き・変換した *.xaml：そのまま写す（tools/ir/convert-xaml.ts で作った C# の XAML を試すときなど）----
for (const f of files.filter((x) => extname(x).toLowerCase() === ".xaml")) {
  const r = newResult(f, "xaml-file");
  const stem = basename(f, extname(f)).toLowerCase();
  if (names.has(stem)) die(`${rel(f)} と IR ${rel(names.get(stem))} が同じ名前の XAML になる`);
  r.workflow = basename(f, extname(f));
  r.target = join(projDir, basename(f));
  cpSync(f, r.target);
  results.push(r);
}

// ---- build / run ----
if (opt.buildOnly) {
  // "buildAlone": true のファイルは、プロジェクトに1つだけ置いて別に build する（Wait 系が別々のファイルにあると分析が落ちる。AUT-1074、knowledge/persistence.md）
  const alone = opt.pack ? [] : results.filter((r) => targetReady(r) && sidecar(r.file).buildAlone); // --pack はファイルを残す（1つずつ渡す）
  const hold = (r, on) => { if (on) renameSync(r.target, `${r.target}.held`); else renameSync(`${r.target}.held`, r.target); };
  const setEntryPoints = (held) => {
    const pjPath = join(projDir, "project.json");
    const pj = readJson(pjPath);
    for (const r of held) {
      const f = `${basename(r.target)}`;
      if (sidecar(r.file).entryPoint) {
        if (r.heldEntry === undefined) r.heldEntry = pj.entryPoints.find((e) => e.filePath === f);
        pj.entryPoints = pj.entryPoints.filter((e) => e.filePath !== f);
      }
    }
    for (const r of alone) {
      if (r.heldEntry && !held.includes(r) && !pj.entryPoints.some((e) => e.filePath === r.heldEntry.filePath)) pj.entryPoints.push(r.heldEntry);
    }
    writeFileSync(pjPath, JSON.stringify(pj, null, 2));
  };
  const buildAll = (only, logName) => {
    const b = uip(["rpa", "build", projDir, "--output", "json"], logName);
    const ok = b.envelope?.Result === "Success";
    for (const r of only) {
      const stem = basename(r.target, extname(r.target));
      const mine = b.raw.split(/\r?\n/).filter((l) => [`${stem}.cs`, `${stem}+`, `${stem}.xaml`].some((k) => l.includes(k)) && /error|エラー/i.test(l)).slice(0, 20);
      r.build = { ok: ok && !mine.length, seconds: b.seconds, errors: ok ? mine : mine.length ? mine : [summarize(b)] };
    }
  };
  for (const r of alone) hold(r, true);
  setEntryPoints(alone);
  const rest = results.filter((r) => targetReady(r) && !alone.includes(r));
  if (rest.length || !alone.length) buildAll(rest, "_build");
  for (const r of alone) {
    hold(r, false);
    setEntryPoints(alone.filter((x) => x !== r));
    buildAll([r], `_build.${safe(r.file)}`);
    hold(r, true);
  }
  // 次の実行のために戻す必要はない（prepareProject が消す）。.held は残ると無駄なので消す
  for (const r of alone) rmSync(`${r.target}.held`, { force: true });
} else {
  for (const r of results) {
    if (!targetReady(r)) continue;
    const side = sidecar(r.file);
    if (side.noRun) { r.run = { skipped: side.noRun }; continue; }
    const args = ["rpa", "run", "--file-path", r.target, "--project-dir", projDir, "--log-level", "Information", "--output", "json"];
    if (side.args) {
      const af = join(logDir, `${safe(r.file)}.args.json`);
      writeFileSync(af, JSON.stringify(side.args));
      args.push("--input-arguments-file", af);
    }
    const x = withRunLock(() => uip(args, safe(r.file) + (r.kind === "coded-gen" ? ".coded" : "")));
    const ok = x.envelope?.Result === "Success";
    const missing = unmatched(expected(r.file), x.logs);
    r.run = { ok: ok && !missing.length, seconds: x.seconds, logs: x.logs, missing, error: ok ? undefined : summarize(x) };
  }
}

// --pack：Helm を使うので窓口の中で流す。パッケージ名は作業用プロジェクトの project.json の name
if (opt.pack) {
  mkdirSync(opt.pack, { recursive: true });
  const p = uip(["rpa", "pack", projDir, opt.pack, ...(opt.packVersion ? ["--package-version", opt.packVersion] : []), "--output", "json"], "_pack");
  if (p.envelope?.Result !== "Success") die(`pack に失敗: ${summarize(p)}`);
  console.log(`PACK ${p.envelope?.Data?.PackagePath}`);
}

// ---- まとめ ----
for (const r of results) r.status = statusOf(r);
const summary = {
  name: opt.name,
  project: projDir,
  mode: opt.buildOnly ? "build" : "run",
  startedAt: new Date(t0).toISOString(),
  seconds: Math.round((Date.now() - t0) / 1000),
  ok: results.every((r) => r.status !== "NG"),
  files: results.map((r) => ({ ...r, file: rel(r.file) + (r.kind === "coded-gen" ? "（C#）" : "") })),
};
writeFileSync(join(reportDir, "report.json"), JSON.stringify(summary, null, 2));
writeFileSync(join(reportDir, "report.md"), markdown(summary));
for (const r of summary.files) console.log(`${r.status.padEnd(4)} ${r.file}${r.status === "NG" ? "  " + reason(r) : r.skipped ? "  " + r.skipped : ""}`);
console.log(`\n${summary.ok ? "すべて OK" : "NG あり"}（${summary.seconds} 秒）→ ${relative(process.cwd(), join(reportDir, "report.md"))}`);
process.exit(summary.ok ? 0 : 1);

// ===========================================================================

function die(msg) { console.error(`verify: ${msg}`); process.exit(2); }
function rel(f) { return relative(root, f).replaceAll("\\", "/"); }
function safe(f) { return rel(f).replace(/[\\/:]/g, "_"); }
function readJson(f) { return JSON.parse(readFileSync(f, "utf8").replace(/^\uFEFF/, "")); }
function fmtIssue(i) { return `${i.line}:${i.col} ${i.code} ${i.message}`; }

function collect(p) {
  if (!existsSync(p)) die(`見つからない: ${p}`);
  if (statSync(p).isDirectory()) { for (const e of readdirSync(p).sort()) collect(join(p, e)); return; }
  if (/\.(verify|expected|args)\.json$/i.test(p)) return;
  if ([".json", ".cs", ".xaml"].includes(extname(p).toLowerCase()) && !files.includes(p)) files.push(p);
}

// 期待するログ（<名前>.expected.log）。無ければ空
function expected(f) {
  const p = join(dirname(f), basename(f, extname(f)) + ".expected.log");
  return existsSync(p) ? readFileSync(p, "utf8").replace(/^﻿/, "").split(/\r?\n/).filter((l) => l.trim()) : [];
}

// 期待する行が、この順に出ているか。出ていない行を返す
function unmatched(want, logs) {
  let at = 0;
  const missing = [];
  for (const w of want) {
    const hasLevel = /^\[\w+\] /.test(w);
    const i = logs.findIndex((l, k) => k >= at && (hasLevel ? l === w : l.replace(/^\[\w+\] /, "") === w));
    if (i < 0) missing.push(w);
    else at = i + 1;
  }
  return missing;
}

function sidecar(f) {
  const p = join(dirname(f), basename(f, extname(f)) + ".verify.json");
  return existsSync(p) ? readJson(p) : {};
}

function prepareProject() {
  if (!existsSync(join(opt.template, "project.json"))) die(`テンプレートが無い: ${opt.template}`);
  if (existsSync(lock)) {
    const pid = Number(readFileSync(lock, "utf8"));
    let alive = false;
    try { process.kill(pid, 0); alive = true; } catch {}
    if (alive) die(`${projDir} は別の verify（pid ${pid}）が使っている。別の --name にする`);
  }
  if (opt.fresh && existsSync(projDir)) rmSync(projDir, { recursive: true, force: true });
  if (!existsSync(projDir)) {
    // プロジェクトの骨組みだけ写す。.local（ビルドのキャッシュ）とワークフローは写さない
    mkdirSync(projDir, { recursive: true });
    for (const e of ["project.json", "project.uiproj", ".settings", ".project", ".objects", ".codedworkflows"]) {
      const src = join(opt.template, e);
      if (existsSync(src)) cpSync(src, join(projDir, e), { recursive: true });
    }
    // name は Coded の名前空間になるので変えない。projectId だけ別にする
    const pj = readJson(join(projDir, "project.json"));
    pj.projectId = randomUUID();
    writeFileSync(join(projDir, "project.json"), JSON.stringify(pj, null, 2));
  }
  // 前回のワークフローを消す。壊れた .cs が残るとプロジェクト全体のコンパイルが落ちるため
  for (const e of readdirSync(projDir)) if (/\.(xaml|cs)$/i.test(e)) rmSync(join(projDir, e));
  rmSync(join(projDir, "coded"), { recursive: true, force: true });
  // サンプルの入力データ（samples/data/、Excel の .xlsx など）を <プロジェクト>/data/ に写し直す。ワークフローは "data\excel\Sample.xlsx" のように相対パスで読む。
  // 書き出すファイルは <プロジェクト>/output/ に置く（毎回空にする）
  for (const d of ["data", "output"]) rmSync(join(projDir, d), { recursive: true, force: true });
  const data = join(root, "samples", "data");
  if (existsSync(data)) cpSync(data, join(projDir, "data"), { recursive: true, filter: (f) => !/\.(mjs|md)$/i.test(f) });
  mkdirSync(join(projDir, "output"), { recursive: true });
}

// run はマシン全体で1つずつにする。ロボット（Assistant）は1ユーザーに1つで、同時に頼んだときの動きを確かめられていないため。
// build は作業用プロジェクトごとに別の Helm が受け持つので、並行してよい（4並列で確かめた）
function withRunLock(fn) {
  const sleep = (ms) => Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);
  let waited = 0;
  for (;;) {
    try { writeFileSync(runLock, String(process.pid), { flag: "wx" }); break; }
    catch (e) {
      if (e.code !== "EEXIST") die(`run のロックを作れない（${runLock}）: ${e.message}`);
      let pid = 0;
      try { pid = Number(readFileSync(runLock, "utf8")); } catch {}
      let alive = false;
      try { if (pid) { process.kill(pid, 0); alive = true; } } catch {}
      if (!alive) { try { unlinkSync(runLock); } catch {} continue; }
      if (waited === 0) console.log(`run の順番待ち（pid ${pid} が実行中）...`);
      sleep(2000); waited += 2;
    }
  }
  try { return fn(); } finally { try { unlinkSync(runLock); } catch {} }
}

function node(args) {
  const r = spawnSync(process.execPath, args, { cwd: root, encoding: "utf8", maxBuffer: 64 << 20 });
  return { status: r.status, stdout: r.stdout ?? "", stderr: r.stderr ?? "" };
}

function uip(args, logName) {
  const s = Date.now();
  const r = spawnSync(process.execPath, [uipJs, ...args], { cwd: projDir, encoding: "utf8", maxBuffer: 64 << 20, timeout: opt.timeout * 1000 });
  const seconds = Math.round((Date.now() - s) / 100) / 10;
  const raw = (r.stdout ?? "") + (r.stderr ? "\n--- stderr ---\n" + r.stderr : "");
  writeFileSync(join(logDir, `${logName}.txt`), `> uip ${args.join(" ")}\n\n${raw}`);
  const timedOut = r.error?.code === "ETIMEDOUT";
  if (timedOut) cleanupAfterTimeout();
  return { raw, seconds, timedOut, envelope: parseEnvelope(r.stdout ?? ""), logs: logLines(raw) };
}

// タイムアウトすると、ダイアログで止まった Excel と Helm が残り、後の run が全部「Studio が応答しない」で落ちる。
// 自動化で起動した Excel（/automation）と、この権限で止められる Helm だけを止める。ユーザーが開いた Excel には触らない
function cleanupAfterTimeout() {
  const ps = "Get-CimInstance Win32_Process | Where-Object { ($_.Name -eq 'EXCEL.EXE' -and $_.CommandLine -match '/automation') -or $_.Name -eq 'UiPath.Studio.Helm.exe' } | ForEach-Object { Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue }";
  spawnSync("powershell.exe", ["-NoProfile", "-Command", ps], { encoding: "utf8", timeout: 30000 });
}

// 出力の最後にある JSON（{ "Result": ... }）を取り出す
function parseEnvelope(out) {
  const i = out.search(/^\{/m);
  if (i < 0) return undefined;
  try { return JSON.parse(out.slice(i)); } catch { return undefined; }
}

// ロボットのログ。uip が出す行（[Information] Validating ...）は除く
function logLines(raw) {
  const skip = /^(Validating |Building |Starting execution|Build succeeded|Execution )/;
  return raw.split(/\r?\n/)
    .map((l) => l.match(/^\[(Trace|Verbose|Information|Warning|Error|Critical|Fatal)\] (.*)$/))
    .filter((m) => m && !skip.test(m[2]))
    .map((m) => `[${m[1]}] ${m[2]}`);
}

function summarize(x) {
  if (x.timedOut) return `タイムアウト（${opt.timeout} 秒）`;
  const e = x.envelope;
  if (!e) return x.raw.trim().split(/\r?\n/).slice(-5).join(" / ").slice(0, 600);
  let msg = e.Message ?? e.ErrorCode ?? JSON.stringify(e).slice(0, 300);
  try { const inner = JSON.parse(msg); msg = inner.errorMessage ?? msg; } catch {}
  msg = String(msg).split(/\r?\n/).filter((l) => !/^\s+at |^--- End of/.test(l)).slice(0, 8).join(" / ").slice(0, 800);
  // 管理者権限（High）のシェルから起動した Helm からは、ロボット（中の権限）に実行を頼めない
  if (/アクセスが拒否されました|Access is denied/.test(msg) && /RemoteException/.test(msg))
    msg += "（Helm が管理者権限で動いている。docs/worker-guide.md の「run がアクセス拒否で落ちる」を見る）";
  return msg;
}

function newResult(file, kind) { return { file, kind }; }
function targetReady(r) { return (r.gen ? r.gen.ok : true) && r.target && existsSync(r.target); }

function statusOf(r) {
  if (r.gen && !r.gen.ok) return "NG";
  if (r.check && !r.check.ok) return "NG";
  if (r.build && !r.build.ok) return "NG";
  if (r.skipped || r.run?.skipped) return "SKIP";
  if (r.run && !r.run.ok) return "NG";
  return "OK";
}

function reason(r) {
  if (r.gen && !r.gen.ok) return `生成: ${r.gen.issues.join("; ")}`;
  if (r.check && !r.check.ok) return `チェッカー: ${r.check.errors.join("; ")}`;
  if (r.build && !r.build.ok) return `build: ${r.build.errors.join("; ")}`;
  if (r.run && !r.run.ok) return r.run.missing?.length && !r.run.error ? `期待したログが無い: ${r.run.missing.join(", ")}` : `run: ${r.run.error}`;
  return "";
}

function markdown(s) {
  const out = [`# verify: ${s.name}`, "", `- プロジェクト: \`${s.project}\``, `- モード: ${s.mode}`, `- 開始: ${s.startedAt}（${s.seconds} 秒）`, `- 結果: ${s.ok ? "すべて OK" : "NG あり"}`, ""];
  out.push("| 状態 | ファイル | 種類 | 秒 | 備考 |", "| --- | --- | --- | --- | --- |");
  for (const r of s.files) {
    const sec = r.run?.seconds ?? r.build?.seconds ?? "";
    const via = r.gen?.notes?.filter((x) => x.startsWith("CODED_VIA_XAML")).length;
    const note = r.status === "NG" ? reason(r) : r.skipped ? `Coded にしない: ${r.skipped}` : r.run?.skipped ? `run しない: ${r.run.skipped}` : r.check?.warnings?.length ? `警告 ${r.check.warnings.length} 件` : via ? `XAML 経由 ${via} 件` : "";
    out.push(`| ${r.status} | ${r.file} | ${r.kind} | ${sec} | ${note.replaceAll("|", "\\|").replace(/\r?\n/g, " ")} |`);
  }
  for (const r of s.files) {
    out.push("", `## ${r.file}`, "");
    if (r.gen && !r.gen.ok) out.push("生成で弾かれた:", "", ...r.gen.issues.map((i) => `- ${i}`));
    if (r.gen?.notes?.length) out.push(...r.gen.notes.map((i) => `- 注意: ${i}`), "");
    if (r.check) {
      for (const e of r.check.errors) out.push(`- エラー: ${e}`);
      for (const w of r.check.warnings) out.push(`- 警告: ${w}`);
    }
    if (r.build) out.push(`build: ${r.build.ok ? "OK" : "NG"}`, ...r.build.errors.map((e) => `- ${e}`));
    if (r.run?.skipped) out.push(`run しない: ${r.run.skipped}`);
    else if (r.run) {
      if (r.run.error) out.push(`run のエラー: ${r.run.error}`, "");
      if (r.run.missing?.length) out.push(`期待したログが無い: ${r.run.missing.join(", ")}`, "");
      out.push("```", ...(r.run.logs.length ? r.run.logs.slice(0, 50) : ["（ログなし）"]), "```");
    }
  }
  return out.join("\n") + "\n";
}
