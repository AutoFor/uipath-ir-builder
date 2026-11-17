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
//   2. <P>/ir/**/*.json を移る先のカタログで検証する。移る先に無いアクティビティ・プロパティがあれば、場所を挙げて止める
//   3. IR の無い XAML（Studio で作ったもの。サブフォルダも）は、移る前のカタログで IR に取り込む
//      （<P>/ir/<XAML と同じフォルダの形>.json。サブフォルダの XAML は IR に "file": "Sub/Foo.xaml" を付け、同じ場所に作り直す）。
//      取り込めない XAML（C# の式、Flowchart など）は、XAML をそのまま移す：移る先に無いアクティビティ・プロパティが無いかを
//      XAML の要素で調べ、ルートの AssemblyReference だけを書き換える（Windows とクロスプラットフォームの XAML の違いはそこだけ）
//   4. project.json の targetFramework を書き換え、XAML を作り直す。ルートの AssemblyReference は WPF の 3 つ
//      （PresentationFramework、WindowsBase、PresentationCore）を外す / 足す（Studio 26.10 の空のプロジェクトの違い）
//   式の言語（VB / C#）はそのまま。IR からは project.json の expressionLanguage で作り直す
//
// しないこと：Coded の .cs は作り直さない（gen-coded.ts で作り直す）。runtimeOptions.requiresUserInteraction は変えない
// （Studio の空のプロジェクトでは Windows が true、Portable が false。UI を操作するかどうかで決める）。
// Invoke Workflow File のパス（プロジェクトからの相対パス）は変えない。呼び先が無ければ注意を出す

import { existsSync, mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { dirname, join, relative, resolve as resolvePath } from "node:path";
import { fileURLToPath } from "node:url";
import { validate, workflowFile } from "./validate.ts";
import { generateChecked, refsForPlatform } from "./generate.ts";
import { importAndCheck, irFileFor, parseXml, placeImported, type El } from "./import-xaml.ts";
import { expandRefs } from "./objrepo.ts";
import { resolve, type Activity, type Catalog } from "./catalog.ts";
import { loadSelected, projectLanguage, projectPlatform, projectRootImports, readProject, VersionError, type Platform, type RootImports } from "./versions.ts";
import type { Issue, Node, Workflow } from "./types.ts";
import { expandTestCase } from "./testcase.ts";
import { graphNodes } from "./graph.ts";
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
  asIs: string[]; // IR に取り込めず、そのまま移した XAML
  written: string[]; // 書いたファイル
};

// IR のノードをすべてたどる（場所つき）
function walkNodes(wf: Workflow, f: (n: Node, at: string) => void) {
  const visitOne = (n: Node, at: string) => walk([n], at, true);
  const walk = (list: Node[] | undefined, path: string, exact = false): void => (list ?? []).forEach((n, i) => {
    const at = exact ? path : `${path}[${i}]`;
    f(n, at);
    walk(n.body, `${at}.body`); walk(n.then, `${at}.then`); walk(n.else, `${at}.else`);
    for (const [k, v] of Object.entries(n.slots ?? {})) walk(v, `${at}.slots.${k}`);
    for (const [k, v] of Object.entries(n.cases ?? {})) walk(v, `${at}.cases.${k}`);
    (n.catches ?? []).forEach((c, j) => walk(c.body, `${at}.catches[${j}].body`));
    for (const g of graphNodes(n)) visitOne(g.node, `${at}.${g.path}`);
  });
  walk(wf.body, "body");
}

// 移る先に無いアクティビティを、分かる言葉にする（検証の UNKNOWN_ACT は「カタログに無い」としか言わない）
function explain(issues: Issue[], wf: Workflow, src: Catalog, to: Platform): string[] {
  const acts = new Map<string, string>();
  walkNodes(wf, (n, at) => acts.set(at, n.act));
  return issues.map((i) => {
    const act = acts.get(i.path);
    if (i.code === "UNKNOWN_ACT" && act) {
      const r = resolve(src, act, false).activity ? resolve(src, act, false) : resolve(src, act, true);
      if (r.activity) return `${i.path}: ${act}（${r.activity.package}）は${NAME[to]}に無い`;
    }
    return `${i.path}: ${i.code} ${i.message}`;
  });
}

const xamlFiles = (dir: string): string[] => readdirSync(dir).flatMap((f) => {
  const p = join(dir, f);
  if (f.startsWith(".") || f === "ir") return [];
  return statSync(p).isDirectory() ? xamlFiles(p) : /\.xaml$/i.test(f) ? [p] : [];
});

// <P>/ir の下の IR（サブフォルダも）。repository.json（オブジェクトリポジトリ）と付属ファイルは除く
const irFiles = (dir: string): string[] => !existsSync(dir) ? [] : readdirSync(dir).sort().flatMap((f) => {
  const p = join(dir, f);
  if (statSync(p).isDirectory()) return irFiles(p);
  return f.endsWith(".json") && f !== "repository.json" && !isSidecar(f) ? [p] : [];
});

// ---- IR に取り込めない XAML をそのまま移す ----

// XAML の要素が指すアクティビティ（カタログの中の）。xmlns が URL（http://schemas.uipath.com/... など）か clr-namespace のどちらでも引く
function actsFor(cat: Catalog, el: El): Activity[] {
  const cls = el.local.replace(/`\d+$/, "");
  return cat.activities.filter((a) => {
    if (a.className !== cls) return false;
    if (a.xmlns === el.uri) return true;
    const ns = a.clrType.slice(0, a.clrType.lastIndexOf("."));
    const m = /^clr-namespace:([^;]+)(?:;assembly=(.+))?$/.exec(el.uri);
    return !!m && m[1] === ns && (!m[2] || m[2] === a.assembly);
  });
}

// 移る前のカタログにあって、移る先のカタログに無いアクティビティ・プロパティを挙げる（どちらのカタログにも無い型は見ない）
export function missingInTarget(xml: string, src: Catalog, dst: Catalog, to: Platform): string[] {
  const out: string[] = [];
  const visit = (el: El, path: string) => {
    if (!el.local.includes(".")) {
      const s = actsFor(src, el);
      if (s.length) {
        const d = actsFor(dst, el);
        const name = el.attrs.find((a) => a.local === "DisplayName")?.value;
        const at = `${path}${name ? `「${name}」` : ""}`;
        // 無いアクティビティの中（MultipleAssign の AssignOperation など）は見ない（同じ理由のエラーが重なるだけ）
        if (!d.length) { out.push(`${at}: ${s[0].className}（${s[0].package}）は${NAME[to]}に無い`); return; }
        {
          const has = (acts: Activity[], p: string) => acts.some((a) => a.props.some((x) => x.name === p));
          const props = [
            ...el.attrs.filter((a) => a.prefix === "").map((a) => a.local),
            ...el.kids.filter((k) => k.local.startsWith(`${el.local}.`)).map((k) => k.local.slice(el.local.length + 1)),
          ];
          for (const p of new Set(props)) if (has(s, p) && !has(d, p)) out.push(`${at}: ${s[0].className}.${p} は${NAME[to]}に無い`);
        }
      }
    }
    const counts = new Map<string, number>();
    for (const k of el.kids) {
      const i = counts.get(k.local) ?? 0;
      counts.set(k.local, i + 1);
      visit(k, `${path}/${k.local}${i ? `[${i}]` : ""}`);
    }
  };
  visit(parseXml(xml), "Activity");
  return out;
}

// ルートの AssemblyReference を、移る先に合わせて書き換える（ほかは 1 文字も変えない）
export function rewriteRootRefs(xml: string, to: Platform): { xaml: string; error?: string } {
  const block = /(<TextExpression\.ReferencesForImplementation>)([\s\S]*?)(<\/TextExpression\.ReferencesForImplementation>)/.exec(xml);
  if (!block) return { xaml: xml };
  const lines = block[2].split(/(?<=\n)/); // 改行を残して分ける
  const refRe = /^(\s*<(?:[\w.]+:)?AssemblyReference>)([^<]*)(<\/(?:[\w.]+:)?AssemblyReference>\r?\n?)$/;
  const idx = lines.map((l, i) => (refRe.test(l) ? i : -1)).filter((i) => i >= 0);
  if (!idx.length) return { xaml: xml };
  if (idx[idx.length - 1] - idx[0] + 1 !== idx.length) return { xaml: xml, error: "ルートの AssemblyReference の並びが読めない（間にほかの行がある）" };
  const refs = idx.map((i) => refRe.exec(lines[i])![2]);
  const next = refsForPlatform(refs, to);
  if (next.join("\n") === refs.join("\n")) return { xaml: xml };
  const [, open, , close] = refRe.exec(lines[idx[0]])!;
  // 最後の行の改行の有無は元のまま
  const lastClose = refRe.exec(lines[idx[idx.length - 1]])![3];
  const body = next.map((r, i) => `${open}${r}${i === next.length - 1 ? lastClose : close}`);
  const merged = [...lines.slice(0, idx[0]), ...body, ...lines.slice(idx[idx.length - 1] + 1)].join("");
  return { xaml: xml.slice(0, block.index) + block[1] + merged + block[3] + xml.slice(block.index + block[0].length) };
}

// Invoke Workflow File の呼び先（文字列リテラルのもの）。パスはプロジェクトからの相対パス
function invokeTargets(wf: Workflow): { at: string; file: string }[] {
  const out: { at: string; file: string }[] = [];
  walkNodes(wf, (n, at) => {
    const v = n.act === "InvokeWorkflowFile" ? n.props?.WorkflowFileName : undefined;
    if (v && typeof v === "object" && "lit" in v && typeof v.lit === "string") out.push({ at, file: v.lit });
  });
  return out;
}
const xamlInvokeTargets = (xml: string) => [...xml.matchAll(/\bWorkflowFileName="([^"[\]]+)"/g)].map((m) => m[1].replace(/&amp;/g, "&"));

export function migratePlatform(project: string, to: Platform, opts: { dryRun?: boolean } = {}): MigrateResult {
  const from = projectPlatform(project);
  const res: MigrateResult = { ok: false, from, to, errors: [], notes: [], imported: [], asIs: [], written: [] };
  if (from === to) { res.ok = true; res.notes.push(`もう ${NAME[to]}（targetFramework "${to}"）。何もしない`); return res; }

  const src = loadSelected(root, project).cat;
  let dst: Catalog;
  try { dst = loadSelected(root, project, { platform: to }).cat; }
  catch (e) { if (!(e instanceof VersionError)) throw e; res.errors.push(e.message); return res; }
  // loadCatalog はモジュールの表（objectTypes など）を差し替えるので、ここからは移る先のカタログだけを使う。
  // 移る前のカタログ（src）は、アクティビティの名前を引くのと、XAML の取り込み（下）にだけ使う

  const language = projectLanguage(project);
  const irDir = join(project, "ir");
  const irs = irFiles(irDir);
  const wfs = new Map<string, Workflow>(); // IR のファイル -> 中身
  for (const f of irs) wfs.set(f, expandTestCase(JSON.parse(readFileSync(f, "utf8").replace(/^﻿/, ""))).wf); // テストケースの Given / When / Then は body に開く
  const asIs = new Map<string, string>(); // そのまま移す XAML のパス -> 書き換えた中身

  // IR の無い XAML を取り込む（移る前のカタログで読む）。取り込めなければ、そのまま移す
  const made = new Set([...wfs.values()].map((w) => resolvePath(project, workflowFile(w)).toLowerCase()));
  const toImport = xamlFiles(project).filter((x) => !made.has(resolvePath(x).toLowerCase()));
  if (toImport.length) {
    const srcAgain = loadSelected(root, project).cat; // objectTypes を移る前のものに戻す
    for (const x of toImport) {
      const xml = readFileSync(x, "utf8");
      const rel = relative(project, x).replace(/\\/g, "/");
      const r = importAndCheck(xml, srcAgain);
      if (!r.wf || r.errors.length || r.validation.length) {
        const why = [...r.errors, ...r.validation].slice(0, 2).map((i) => `${i.code} ${i.path}`).join(" / ") || "取り込めない";
        const miss = missingInTarget(xml, src, dst, to);
        if (miss.length) { res.errors.push(...miss.map((m) => `${rel} ${m}`)); continue; }
        const rw = rewriteRootRefs(xml, to);
        if (rw.error) { res.errors.push(`${rel} は IR に取り込めず（${why}）、そのまま移すこともできない：${rw.error}`); continue; }
        asIs.set(x, rw.xaml);
        res.asIs.push(rel);
        res.notes.push(`${rel} は IR に取り込めない（${why}）。XAML をそのまま移す（ルートの参照だけ書き換える）`);
        continue;
      }
      const f = join(irDir, irFileFor(rel));
      if (wfs.has(f)) { res.errors.push(`${rel} を取り込むと ${relative(project, f)} と重なる`); continue; }
      wfs.set(f, placeImported(r.wf, rel));
      res.imported.push(rel);
      if (r.roundTrip && !r.roundTrip.sameMeaning) res.notes.push(`${rel} は取り込むと意味が変わるところがある（import-xaml.ts ${rel} で警告を見る）`);
    }
    loadSelected(root, project, { platform: to }); // 移る先のカタログの表に戻す
  }
  if (!wfs.size && !asIs.size) res.notes.push("IR も XAML も無い。project.json だけ書き換える");

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
    out.set(join(project, workflowFile(wf0)), r!.xaml);
  }

  // Invoke Workflow File の呼び先が、移したあとのプロジェクトにあるか（パスはプロジェクトからの相対パス）
  const after = new Set([...out.keys(), ...asIs.keys(), ...xamlFiles(project)].map((p) => resolvePath(p).toLowerCase()));
  const calls = [
    ...[...wfs].flatMap(([f, wf]) => invokeTargets(wf).map((t) => ({ from: `${relative(project, f)} ${t.at}`, file: t.file }))),
    ...[...asIs].flatMap(([x, xml]) => xamlInvokeTargets(xml).map((file) => ({ from: relative(project, x), file }))),
  ];
  for (const c of calls) if (!after.has(resolvePath(project, c.file).toLowerCase())) res.notes.push(`${c.from}: Invoke Workflow File の呼び先 "${c.file}" がプロジェクトに無い（パスはプロジェクトからの相対パス）`);

  if (!rootImports) res.notes.push(`ルートの imports は ${NAME[to]}の BlankTemplate の並びを使う`);
  if (readdirSync(project).some((f) => f.endsWith(".cs"))) res.notes.push("Coded の .cs はそのまま。要るなら gen-coded.ts で作り直す");
  const pj = readProject(project);
  if (pj.runtimeOptions?.requiresUserInteraction !== undefined)
    res.notes.push(`runtimeOptions.requiresUserInteraction（${pj.runtimeOptions.requiresUserInteraction}）は変えない。Studio の空のプロジェクトでは Windows が true、${NAME.Portable}が false`);
  if (res.errors.length) return res;
  res.ok = true;
  if (opts.dryRun) return res;

  // 書く：IR（取り込んだもの）、XAML、project.json の順
  for (const [f, wf] of wfs) if (!irs.includes(f)) { mkdirSync(dirname(f), { recursive: true }); writeFileSync(f, JSON.stringify(wf, null, 2) + "\n", "utf8"); res.written.push(f); }
  for (const [p, xaml] of out) { mkdirSync(dirname(p), { recursive: true }); writeFileSync(p, "﻿" + xaml, "utf8"); res.written.push(p); }
  for (const [p, xaml] of asIs) { writeFileSync(p, xaml, "utf8"); res.written.push(p); }
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
  for (const x of r.asIs) console.log(`  そのまま移す ${x}`);
  for (const n of r.notes) console.log(`  注意 ${n}`);
  for (const w of r.written) console.log(`  書いた ${w}`);
  process.exit(r.ok ? 0 : 1);
}

if (process.argv[1] && resolvePath(process.argv[1]) === fileURLToPath(import.meta.url)) main();
