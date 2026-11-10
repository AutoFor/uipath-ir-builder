// UiPath プロジェクトを Windows ⇄ クロスプラットフォーム（project.json の targetFramework が Portable）に移す。
//
//   node tools/ir/migrate-platform.ts --project <P> --to Portable|Windows [--dry-run]
//     --to Portable   Windows → クロスプラットフォーム
//     --to Windows    クロスプラットフォーム → Windows
//     --dry-run       調べるだけ（何も書かない）
//   終了コード: 0 = 移した（--dry-run では、移せる） / 1 = 移せない（理由を出す。何も書かない） / 2 = 使い方の誤り
//
// すること（AI が書くのは IR だけなので、XAML は移る先のカタログで IR から作り直す）:
//   1. 移る先の版のカタログを選ぶ（Portable は catalog/<pkg>/<版>.portable.json。無ければ作り方を出して止める）
//   2. <P>/ir/*.json を移る先のカタログで検証する。移る先に無いアクティビティ・プロパティがあれば、場所を挙げて止める
//   3. IR の無い XAML（Studio で作ったもの）は、移る前のカタログで IR に取り込む（<P>/ir/<workflow>.json）。取り込めなければ止める
//   4. project.json の targetFramework を書き換え、XAML を作り直す。ルートの AssemblyReference は WPF の 3 つ
//      （PresentationFramework、WindowsBase、PresentationCore）を外す / 足す（Studio 26.10 の空のプロジェクトの違い）
//
// しないこと：Coded の .cs は作り直さない（gen-coded.ts で作り直す）。runtimeOptions.requiresUserInteraction は変えない
// （Studio の空のプロジェクトでは Windows が true、Portable が false。UI を操作するかどうかで決める）。

import { existsSync, mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { dirname, join, relative, resolve as resolvePath } from "node:path";
import { fileURLToPath } from "node:url";
import { validate } from "./validate.ts";
import { generateChecked, refsForPlatform } from "./generate.ts";
import { importAndCheck } from "./import-xaml.ts";
import { expandRefs } from "./objrepo.ts";
import { resolve, type Catalog } from "./catalog.ts";
import { loadSelected, projectLanguage, projectPlatform, projectRootImports, readProject, VersionError, type Platform, type RootImports } from "./versions.ts";
import type { Issue, Workflow } from "./types.ts";
const isSidecar = (f: string) => /\.(verify|expected|args)\.json$/i.test(f); // gen.ts と同じ（gen.ts は読み込むと動き出すので写す）

const root = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const NAME: Record<Platform, string> = { Windows: "Windows", Portable: "クロスプラットフォーム" };

export type MigrateResult = {
  ok: boolean;
  from: Platform;
  to: Platform;
  errors: string[]; // 移せない理由
  notes: string[];
  imported: string[]; // IR に取り込んだ XAML
  written: string[]; // 書いたファイル
};

// 移る先に無いアクティビティを、分かる言葉にする（検証の UNKNOWN_ACT は「カタログに無い」としか言わない）
function explain(issues: Issue[], wf: Workflow, src: Catalog, to: Platform): string[] {
  const acts = new Map<string, string>();
  const walk = (list: Workflow["body"] | undefined, path: string) => (list ?? []).forEach((n, i) => {
    const at = `${path}[${i}]`;
    acts.set(at, n.act);
    walk(n.body, `${at}.body`); walk(n.then, `${at}.then`); walk(n.else, `${at}.else`);
    for (const [k, v] of Object.entries(n.slots ?? {})) walk(v, `${at}.slots.${k}`);
    for (const [k, v] of Object.entries(n.cases ?? {})) walk(v, `${at}.cases.${k}`);
    (n.catches ?? []).forEach((c, j) => walk(c.body, `${at}.catches[${j}].body`));
  });
  walk(wf.body, "body");
  return issues.map((i) => {
    const act = acts.get(i.path);
    if (i.code === "UNKNOWN_ACT" && act) {
      const r = resolve(src, act, false).activity ? resolve(src, act, false) : resolve(src, act, true);
      if (r.activity) return `${i.path}: ${act}（${r.activity.package}）は${NAME[to]}に無い`;
    }
    return `${i.path}: ${i.code} ${i.message}`;
  });
}

const xamlFiles = (dir: string, base = dir): string[] => readdirSync(dir).flatMap((f) => {
  const p = join(dir, f);
  if (f.startsWith(".") || f === "ir") return [];
  return statSync(p).isDirectory() ? xamlFiles(p, base) : /\.xaml$/i.test(f) ? [p] : [];
});

export function migratePlatform(project: string, to: Platform, opts: { dryRun?: boolean } = {}): MigrateResult {
  const from = projectPlatform(project);
  const res: MigrateResult = { ok: false, from, to, errors: [], notes: [], imported: [], written: [] };
  if (from === to) { res.ok = true; res.notes.push(`もう ${NAME[to]}（targetFramework "${to}"）。何もしない`); return res; }

  const src = loadSelected(root, project).cat;
  let dst: Catalog;
  try { dst = loadSelected(root, project, { platform: to }).cat; }
  catch (e) { if (!(e instanceof VersionError)) throw e; res.errors.push(e.message); return res; }
  // loadCatalog はモジュールの表（objectTypes など）を差し替えるので、ここからは移る先のカタログだけを使う。
  // 移る前のカタログ（src）は、アクティビティの名前を引くのと、XAML の取り込み（下）にだけ使う

  const language = projectLanguage(project);
  const irDir = join(project, "ir");
  const irs = existsSync(irDir) ? readdirSync(irDir).filter((f) => f.endsWith(".json") && f !== "repository.json" && !isSidecar(f)).map((f) => join(irDir, f)) : [];
  const wfs = new Map<string, Workflow>(); // IR のファイル -> 中身
  for (const f of irs) wfs.set(f, JSON.parse(readFileSync(f, "utf8")));

  // IR の無い XAML を取り込む（移る前のカタログで読む）
  const made = new Set([...wfs.values()].map((w) => resolvePath(project, `${w.workflow}.xaml`).toLowerCase()));
  const toImport = xamlFiles(project).filter((x) => !made.has(resolvePath(x).toLowerCase()));
  if (toImport.length) {
    const srcAgain = loadSelected(root, project).cat; // objectTypes を移る前のものに戻す
    for (const x of toImport) {
      const r = importAndCheck(readFileSync(x, "utf8"), srcAgain);
      const rel = relative(project, x);
      if (!r.wf || r.errors.length || r.validation.length) {
        res.errors.push(`${rel} は IR が無く、取り込めもしない（${[...r.errors, ...r.validation].slice(0, 3).map((i) => `${i.code} ${i.path}`).join(" / ") || "取り込めない"}）。import-xaml.ts で見て直す`);
        continue;
      }
      if (relative(project, resolvePath(project, `${r.wf.workflow}.xaml`)) !== rel) {
        res.errors.push(`${rel} の x:Class は "${r.wf.workflow}"。作り直すと ${r.wf.workflow}.xaml になり、ファイルの場所が変わる（サブフォルダの XAML はまだ移せない）`);
        continue;
      }
      const f = join(irDir, `${r.wf.workflow}.json`);
      if (wfs.has(f)) { res.errors.push(`${rel} を取り込むと ${f} と重なる`); continue; }
      wfs.set(f, r.wf);
      res.imported.push(rel);
      if (r.roundTrip && !r.roundTrip.sameMeaning) res.notes.push(`${rel} は取り込むと意味が変わるところがある（import-xaml.ts ${rel} で警告を見る）`);
    }
    loadSelected(root, project, { platform: to }); // 移る先のカタログの表に戻す
  }
  if (!wfs.size) res.notes.push("IR も XAML も無い。project.json だけ書き換える");

  // 移る先のカタログで検証して、作ってみる
  const imp = projectRootImports(project, from).imports;
  const rootImports: RootImports | undefined = imp ? { imports: imp.imports, refs: refsForPlatform(imp.refs, to) } : undefined;
  const out = new Map<string, string>(); // XAML のパス -> 中身
  for (const [f, wf0] of wfs) {
    const ex = expandRefs(wf0, dst, project);
    const issues = ex.issues.length ? ex.issues : validate(ex.wf, dst);
    const r = issues.length ? undefined : generateChecked(ex.wf, dst, { rootImports, language });
    const all = r ? r.issues : issues;
    if (all.length) { res.errors.push(...explain(all, ex.wf, src, to).map((m) => `${relative(project, f)} ${m}`)); continue; }
    out.set(join(project, `${wf0.workflow}.xaml`), r!.xaml);
  }
  if (!rootImports) res.notes.push(`ルートの imports は ${NAME[to]}の BlankTemplate の並びを使う`);
  if (readdirSync(project).some((f) => f.endsWith(".cs"))) res.notes.push("Coded の .cs はそのまま。要るなら gen-coded.ts で作り直す");
  const pj = readProject(project);
  if (pj.runtimeOptions?.requiresUserInteraction !== undefined)
    res.notes.push(`runtimeOptions.requiresUserInteraction（${pj.runtimeOptions.requiresUserInteraction}）は変えない。Studio の空のプロジェクトでは Windows が true、${NAME.Portable}が false`);
  if (res.errors.length) return res;
  res.ok = true;
  if (opts.dryRun) return res;

  // 書く：IR（取り込んだもの）、XAML、project.json の順
  for (const [f, wf] of wfs) if (!irs.includes(f)) { mkdirSync(irDir, { recursive: true }); writeFileSync(f, JSON.stringify(wf, null, 2) + "\n", "utf8"); res.written.push(f); }
  for (const [p, xaml] of out) { writeFileSync(p, "﻿" + xaml, "utf8"); res.written.push(p); }
  const pjFile = join(project, "project.json");
  const text = readFileSync(pjFile, "utf8");
  const re = /("targetFramework"\s*:\s*)"[^"]*"/;
  const next = re.test(text) ? text.replace(re, `$1"${to}"`) : text.replace(/\n\}\s*$/, `,\n  "targetFramework": "${to}"\n}`);
  writeFileSync(pjFile, next, "utf8");
  res.written.push(pjFile);
  return res;
}

function main() {
  const args = process.argv.slice(2);
  const val = (k: string) => { const i = args.indexOf(k); return i >= 0 ? args[i + 1] : undefined; };
  const project = val("--project"), to = val("--to");
  if (!project || (to !== "Portable" && to !== "Windows")) {
    console.error("使い方: node tools/ir/migrate-platform.ts --project <P> --to Portable|Windows [--dry-run]");
    process.exit(2);
  }
  const dry = args.includes("--dry-run");
  let r: MigrateResult;
  try { r = migratePlatform(resolvePath(project), to, { dryRun: dry }); }
  catch (e) { if (!(e instanceof VersionError)) throw e; console.error(e.message); process.exit(2); }
  console.log(`${r.ok ? "OK" : "NG"} ${NAME[r.from]} → ${NAME[r.to]}${dry ? "（--dry-run）" : ""} ${project}`);
  for (const e of r.errors) console.log(`  移せない ${e}`);
  for (const x of r.imported) console.log(`  IR に取り込む ${x}`);
  for (const n of r.notes) console.log(`  注意 ${n}`);
  for (const w of r.written) console.log(`  書いた ${w}`);
  process.exit(r.ok ? 0 : 1);
}

if (process.argv[1] && resolvePath(process.argv[1]) === fileURLToPath(import.meta.url)) main();
