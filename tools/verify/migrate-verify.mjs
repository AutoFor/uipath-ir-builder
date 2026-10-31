// XAML → IR → C# の通しの確認。元の XAML から取り込んだ IR で C# を作り、窓口（queue-run.mjs）で build / run して、元の期待ログと比べる。
//
//   node tools/verify/migrate-verify.mjs --name <作業名> --scan <pkg>...              … 取り込みと C# の生成だけ（窓口を使わない）。全件の分類を出す
//   node tools/verify/migrate-verify.mjs --name <作業名> --pkg <pkg> [--pkg <pkg>] [--limit 20] [--skip 0] [--filter 正規表現] [--build-only] [--timeout 120]
//   node tools/verify/migrate-verify.mjs --name <作業名> [--build-only] [--timeout 120] <file.xaml>...   … 指定した XAML（Studio が保存した実物など）
//
// samples/generated/<pkg>/<workflow>.xaml を取り込み、out/migrate/<name>/ir/<workflow>.json に書く。
// 同じ workflow の samples/ir/<pkg>/*.json の横の *.expected.log と *.verify.json を写す（元の IR は使わない。比べるログだけ借りる）。
// 期待ログが無く noRun でもないものは「比べられない」ので、--pkg のときは対象にしない。
// 実物の XAML は期待ログが無いので、verify.mjs が XAML と C# の両方を run する。ログの一致はこのスクリプトが比べる。
//
// 分類: import（取り込めない）/ validate（IR が検証を通らない）/ <issue code>（C# を作れない。NO_CODED_API など）/ noRun / noExpected / ok

import { spawnSync } from "node:child_process";
import { copyFileSync, existsSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { basename, dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..");
const argv = process.argv.slice(2);
const opt = { name: "", pkgs: [], limit: 20, skip: 0, filter: undefined, buildOnly: false, timeout: 120, scan: false };
const xamls = [];
for (let i = 0; i < argv.length; i++) {
  const a = argv[i];
  if (a === "--name") opt.name = argv[++i];
  else if (a === "--pkg") opt.pkgs.push(argv[++i]);
  else if (a === "--limit") opt.limit = Number(argv[++i]);
  else if (a === "--skip") opt.skip = Number(argv[++i]);
  else if (a === "--filter") opt.filter = new RegExp(argv[++i]);
  else if (a === "--timeout") opt.timeout = Number(argv[++i]);
  else if (a === "--build-only") opt.buildOnly = true;
  else if (a === "--scan") opt.scan = true;
  else if (a.startsWith("--")) { console.error(`知らないオプション ${a}`); process.exit(2); }
  else if (opt.scan) opt.pkgs.push(a);
  else xamls.push(resolve(a));
}
if (!opt.name) { console.error("--name が要る"); process.exit(2); }

const { loadCatalog } = await import("../ir/catalog.ts");
const { CATALOG_FILES, importAndCheck } = await import("../ir/import-xaml.ts");
const { loadMappings } = await import("../ir/mapping.ts");
const { generateCoded } = await import("../ir/generate-coded.ts");
const cat = loadCatalog(root, CATALOG_FILES);
const { maps } = loadMappings(root);

const outDir = join(root, "out", "migrate", opt.name);
const irDir = join(outDir, "ir");
rmSync(irDir, { recursive: true, force: true });
mkdirSync(irDir, { recursive: true });

// samples/ir/<pkg> の workflow → IR ファイル
function irIndex(pkg) {
  const dir = join(root, "samples", "ir", pkg);
  const m = new Map();
  for (const f of readdirSync(dir)) {
    if (!f.endsWith(".json") || /\.(verify|expected|args|types)\.json$/.test(f)) continue;
    try { const w = JSON.parse(readFileSync(join(dir, f), "utf8").replace(/^﻿/, "")).workflow; if (w) m.set(w, join(dir, f)); } catch {}
  }
  return m;
}

function classify(file, index) {
  const xml = readFileSync(file, "utf8");
  const imp = importAndCheck(xml, cat);
  const r = { file, workflow: imp.wf?.workflow, status: "ok", detail: [], wf: imp.wf };
  if (imp.errors.length || !imp.wf) return { ...r, status: "import", detail: imp.errors.map((e) => `${e.code} ${e.path}: ${e.message}`) };
  if (imp.validation.length) return { ...r, status: "validate", detail: imp.validation.map((e) => `${e.code} ${e.path}: ${e.message}`) };
  const g = generateCoded(imp.wf, cat, maps, { namespace: "CatalogProbeNet8" });
  if (g.issues.length) {
    const codes = [...new Set(g.issues.map((i) => i.code))];
    return { ...r, status: codes.includes("NO_CODED_API") && codes.length === 1 ? "NO_CODED_API" : codes.filter((c) => c !== "NO_CODED_API").join("+"), detail: g.issues.map((i) => `${i.code} ${i.path}: ${i.message}`) };
  }
  if (index) {
    const src = index.get(imp.wf.workflow);
    if (!src) return { ...r, status: "noExpected", detail: ["元の IR が見つからない"] };
    r.src = src;
    const stem = src.replace(/\.json$/, "");
    const side = existsSync(`${stem}.verify.json`) ? JSON.parse(readFileSync(`${stem}.verify.json`, "utf8").replace(/^﻿/, "")) : {};
    if (side.noRun) return { ...r, status: "noRun", detail: [side.noRun] };
    if (!existsSync(`${stem}.expected.log`)) return { ...r, status: "noExpected", detail: ["期待ログが無い"] };
  }
  return r;
}

function writeIr(r) {
  const dest = join(irDir, `${r.wf.workflow}.json`);
  writeFileSync(dest, JSON.stringify(r.wf, null, 2) + "\n", "utf8");
  if (r.src) for (const ext of [".expected.log", ".verify.json"]) {
    const s = r.src.replace(/\.json$/, ext);
    if (existsSync(s)) copyFileSync(s, join(irDir, `${r.wf.workflow}${ext}`));
  }
  return dest;
}

function summarize(rows) {
  const by = new Map();
  for (const r of rows) by.set(r.status, [...(by.get(r.status) ?? []), r]);
  const lines = [...by].sort((a, b) => b[1].length - a[1].length).map(([s, l]) => `${String(l.length).padStart(4)}  ${s}`);
  return { by, text: lines.join("\n") };
}

let rows = [];
const samples = [];
for (const pkg of opt.pkgs) {
  const dir = join(root, "samples", "generated", pkg);
  const index = irIndex(pkg);
  for (const f of readdirSync(dir).filter((x) => x.endsWith(".xaml")).sort()) samples.push(classify(join(dir, f), index));
}
rows = samples;
const real = xamls.map((f) => classify(f));
writeFileSync(join(outDir, "classify.json"), JSON.stringify([...rows, ...real].map(({ wf, ...r }) => r), null, 2));

if (opt.scan) {
  const { by, text } = summarize(rows);
  console.log(text);
  for (const [s, l] of by) {
    if (["ok", "noRun", "noExpected", "NO_CODED_API"].includes(s)) continue;
    console.log(`\n## ${s}`);
    for (const r of l) console.log(`- ${basename(r.file)}\n    ${r.detail.slice(0, 3).join("\n    ")}`);
  }
  console.log(`\n-> ${join(outDir, "classify.json")}`);
  process.exit(0);
}

// 代表：アクティビティの偏りを避けるため、ok の中から等間隔に選ぶ
let targets = rows.filter((r) => r.status === "ok" && (!opt.filter || opt.filter.test(r.workflow)));
if (opt.limit && targets.length > opt.limit && !opt.filter) {
  const step = targets.length / opt.limit;
  targets = Array.from({ length: opt.limit }, (_, i) => targets[Math.floor(i * step + opt.skip) % targets.length]);
}
// InvokeWorkflowFile の呼び出し先も一緒に流す（無いと run で「ワークフローが見つかりません」になる）
for (let i = 0; i < targets.length; i++) {
  for (const m of readFileSync(targets[i].file, "utf8").matchAll(/WorkflowFileName="([^"\\/]+)\.xaml"/g)) {
    const callee = rows.find((r) => r.workflow === m[1]);
    if (callee && !targets.includes(callee)) targets.push(callee);
  }
}
targets = [...new Map(targets.map((r) => [r.workflow, r])).values()];
for (const r of real) {
  console.log(`${r.status === "ok" ? "OK" : "NG"} 取り込みと生成 ${r.file}`);
  for (const d of r.detail) console.log(`   ${d}`);
}
targets.push(...real.filter((r) => r.status === "ok"));
if (!targets.length) { console.log("流すものが無い"); process.exit(real.length ? 1 : 0); }

const files = targets.map(writeIr);
const args = [join(root, "tools", "verify", "queue-run.mjs"), "--name", opt.name, "--timeout", String(opt.timeout), ...(opt.buildOnly ? ["--build-only"] : []), ...files];
console.log(`${targets.length} 件を窓口に頼む: ${targets.map((r) => r.workflow).join(", ")}`);
const q = spawnSync(process.execPath, args, { cwd: root, encoding: "utf8", maxBuffer: 256 << 20 });
console.log(q.stdout ?? "");
if (q.stderr) console.error(q.stderr);

// 実物は期待ログが無いので、XAML と C# のログを比べる
const reportPath = join(root, "out", "verify", `${opt.name}-run`, "report.json");
let bad = q.status ?? 1;
if (existsSync(reportPath) && !opt.buildOnly) {
  const rep = JSON.parse(readFileSync(reportPath, "utf8"));
  for (const r of real.filter((x) => x.status === "ok")) {
    const x = rep.files.filter((f) => f.workflow === r.workflow);
    const xaml = x.find((f) => f.kind === "xaml")?.run?.logs, cs = x.find((f) => f.kind === "coded-gen")?.run?.logs;
    const same = JSON.stringify(xaml) === JSON.stringify(cs);
    console.log(`${same ? "同じ" : "違う"} XAML と C# のログ ${r.workflow}`);
    if (!same) { bad = 1; console.log(`  XAML: ${JSON.stringify(xaml)}\n  C#:   ${JSON.stringify(cs)}`); }
  }
}
process.exit(bad);
