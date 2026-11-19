// IR を検証して Coded Workflow（C#）を書き出す。生成した C# は tools/coded/check.ts でも検証する。
//
// 使い方:
//   node tools/ir/gen-coded.ts samples/ir/Main.json [...] --out <フォルダ>
//   node tools/ir/gen-coded.ts samples/ir/Main.json --check          （検証と生成だけ。書き出さない）
//   オプション:
//     --namespace <名前>   既定 CatalogProbeNet8（UiPath プロジェクトの名前。CodedWorkflow の部分クラスと同じ名前空間）
//     --invoke-dir <dir>   InvokeWorkflowFile の "X.xaml" を "<dir>/X.cs" に書き換える（Coded 同士で呼ぶ）
//     --print              生成した C# を標準出力に出す
//     --project <dir>      その UiPath プロジェクトの project.json の dependencies の版のカタログを使う。名前空間の既定もそのプロジェクトから取る。
//                          そのプロジェクトの .local/.codedworkflows/ObjectRepository.cs があれば、リポジトリにあるターゲット（Reference）は Descriptors.<アプリ>.<画面>.<要素> で書く
//     --no-descriptors     リポジトリにあるターゲットも、これまでどおり new TargetAnchorableModel { ... } で書く
//     --compact            オプションを1行にまとめて書く（既定は1行に1つ、行末に // Studio の日本語の名前。catalog/<パッケージ>/<版>.ja.json がある版だけ）
//     --settings <Release|Debug>  プロジェクト設定（.settings/<プロファイル>）の既定値を、IR で未設定の props に補う。既定は Release（Orchestrator のジョブ）。--no-settings で補わない
//     --no-trace-log       操作（クリック・入力・待機など）の直前に入れる Log(…, Trace) を入れない（既定は、読みやすい形のとき入れる。// 手順名 の代わり）
//                          カタログに無い版、services の無い古いカタログ（対応表のあるパッケージ）はエラー
//     --no-via-xaml        対応表の無いアクティビティを XAML 経由にしない（NO_MAPPING のエラーにする）
//
//   対応表の無いアクティビティ（と、Coded API の無いパッケージ、対応表が「Coded API なし」、対応表の API がその版に無いアクティビティ）は、XAML にして C# から RunWorkflow で呼ぶ。
//   子の無いものは 1つのアクティビティだけの汎用の XAML を <--out>/_activities/<ClassName>[_<形のハッシュ>].xaml に、子のあるものは部分木の XAML を <--out>/_xaml/<ワークフロー名>_<連番>.xaml に
//   書き出し、C# からは RunWorkflow で呼ぶ（注意 CODED_VIA_XAML を出す。knowledge/coded-via-xaml.md）。XAML の式の言語は --project の expressionLanguage
//
//   テストケース（IR の "testCase"）は [TestCase] を付ける（Given / When / Then は名前付きの Sequence なので "// Given" などの行になる）。
//   XAML と違い、project.json の fileInfoCollection には載せない（載せると Studio がそのクラスを別に扱い、uip rpa run が
//   「型 … が名前空間 … に存在しません」で落ちた。knowledge/testing.md の「テストケース」）

import { existsSync, readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { join, dirname, relative, isAbsolute } from "node:path";
import { fileURLToPath } from "node:url";
import { validate } from "./validate.ts";
import { expandRefs } from "./objrepo.ts";
import { descriptorsFile, readDescriptors } from "./coded-descriptors.ts";
import { projectDefaults, readSettings } from "./project-settings.ts";
import { generateCoded, type ViaXamlFile } from "./generate-coded.ts";
import { generateChecked, type ExpressionLanguage } from "./generate.ts";
import { loadMappings } from "./mapping.ts";
import { checkSource, loadContext } from "../coded/check.ts";
import { loadSelected, runSelection, noCodedApiPackages, projectLanguage, projectRootImports } from "./versions.ts";
import type { Workflow } from "./types.ts";
import { expandTestCase, codedTestCaseIssues } from "./testcase.ts";

const root = join(dirname(fileURLToPath(import.meta.url)), "..", "..");

const args = process.argv.slice(2);
const val = (k: string) => { const i = args.indexOf(k); return i >= 0 ? args[i + 1] : undefined; };
const outDir = val("--out");
const project = val("--project");
const invokeDir = val("--invoke-dir");
const checkOnly = args.includes("--check");
const print = args.includes("--print");
const noViaXaml = args.includes("--no-via-xaml");
const valued = new Set(["--out", "--namespace", "--invoke-dir", "--project", "--settings"]);
const descriptors = project && !args.includes("--no-descriptors") ? readDescriptors(project) : undefined;
if (project && !args.includes("--no-descriptors") && !descriptors) console.error(`注意: ${descriptorsFile(project)} が無い。ターゲットは new TargetAnchorableModel で書く（Studio でビルドすると作られる）`);
const files = args.filter((a, i) => !a.startsWith("--") && !valued.has(args[i - 1]) && !/\.(verify|expected|args)\.json$/i.test(a));
if (!files.length || (!outDir && !checkOnly)) {
  console.error("使い方: node tools/ir/gen-coded.ts <ir.json>... (--out <dir> | --check) [--namespace <名前>] [--invoke-dir <dir>] [--print] [--project <dir>]");
  process.exit(2);
}

const { cat, ctx, noApi, language, rootImports, labels } = runSelection(() => {
  const { cat, warnings, selection } = loadSelected(root, project, { coded: true });
  const imp = project ? projectRootImports(project) : { imports: undefined, notes: [] as string[] };
  for (const w of [...warnings, ...imp.notes]) console.error(`注意: ${w}`);
  // XAML 経由の XAML も、gen.ts の --project と同じく project.json の式の言語にする
  const language: ExpressionLanguage = project ? projectLanguage(project) : "VisualBasic";
  // Studio の日本語の名前（catalog/<パッケージ>/<版>.ja.json。tools/catalog-extractor/extract-ja.ps1 で作る）
  const labels: Record<string, string> = {};
  for (const f of selection.files) { const j = join(root, f.replace(/(\.portable)?\.json$/, ".ja.json")); if (existsSync(j)) Object.assign(labels, JSON.parse(readFileSync(j, "utf8"))); }
  return { cat, ctx: loadContext(project), noApi: noCodedApiPackages(root, selection.files), language, rootImports: imp.imports, labels };
});
// XAML 経由で呼ぶ XAML の置き場所（プロジェクトからの相対パス）。--out がプロジェクトの中ならその相対パス、
// でなければ --invoke-dir（verify.mjs は coded）、どちらも無ければ --out をプロジェクトのフォルダとみなす。その下の _xaml/
const outRel = project && outDir && !relative(project, outDir).startsWith("..") && !isAbsolute(relative(project, outDir)) ? relative(project, outDir).replace(/\\/g, "/") : invokeDir ?? "";
const viaDir = [outRel, "_xaml"].filter(Boolean).join("/");
const { maps, errors: mapErrors } = loadMappings(root);
if (mapErrors.length) { for (const e of mapErrors) console.log(`対応表のエラー: ${e}`); process.exit(1); }
const ns = val("--namespace") ?? ctx.namespace;
ctx.namespace = ns;

// 対応表で書いた C# が、選んだ版の API に無いメソッド・合わないオーバーロードを呼ぶなら、そのノードを XAML 経由にする（版で API が違う）
const apiCheck = (code: string) => {
  const errs = checkSource(code, "node.cs", ctx).issues.filter((i) => i.code === "UNKNOWN_METHOD" || i.code === "NO_OVERLOAD");
  return errs.length ? `この版の Coded API に合うメソッドが無い（${errs.map((e) => e.message).join(" / ").slice(0, 200)}）` : undefined;
};

let failed = false;
for (const f of files) {
  const tc = expandTestCase(JSON.parse(readFileSync(f, "utf8").replace(/^﻿/, "")) as Workflow);
  const ex = expandRefs(tc.wf, cat, project);
  const wf = ex.wf;
  const issues = tc.issues.length ? [...tc.issues] : ex.issues.length ? [...ex.issues] : validate(wf, cat);
  let code = "";
  let warns: { path: string; code: string; message: string }[] = [];
  const subs: { file: ViaXamlFile; xaml: string }[] = [];
  if (!issues.length) {
    const r = generateCoded(wf, cat, maps, { namespace: ns, invokePath: invokeDir ? (p) => p.replace(/^(.*?)([^\\/]+)\.xaml$/i, `${invokeDir}/$2.cs`) : undefined, viaXaml: noViaXaml ? undefined : { dir: viaDir, noApi, apiCheck }, descriptors, projectDefaults: project && !args.includes("--no-settings") ? projectDefaults(cat, readSettings(project, val("--settings") === "Debug" ? "Debug" : "Release")) : undefined, labels: args.includes("--compact") || !Object.keys(labels).length ? undefined : labels, traceLog: !args.includes("--compact") && !args.includes("--no-trace-log") && Object.keys(labels).length > 0 });
    issues.push(...r.issues);
    code = r.code;
    // Coded のテストケースにはデータ駆動のテストをつなげない（data は使わず、注意だけ出す）
    warns = [...r.warnings, ...codedTestCaseIssues(wf)];
    // XAML 経由の XAML を作る（C# の式に直せないものは、そのノードの場所のエラーにする）
    if (!r.issues.length) for (const x of r.xamls) {
      const g = generateChecked(x.wf, cat, { rootImports, language });
      for (const i of g.issues) issues.push({ path: x.at, code: i.code, message: `XAML 経由（${x.path}）: ${i.path}: ${i.message}` });
      subs.push({ file: x, xaml: g.xaml });
    }
  }
  // 対応表が「Coded API なし」としているものだけなら、失敗ではなく SKIP（理由を出す）
  if (issues.length && issues.every((i) => i.code === "NO_CODED_API")) {
    console.log(`SKIP ${f}`);
    for (const i of issues) console.log(`  ${i.code.padEnd(20)} ${i.path}: ${i.message}`);
    continue;
  }
  if (issues.length) {
    failed = true;
    console.log(`NG ${f}`);
    for (const i of issues) console.log(`  ${i.code.padEnd(20)} ${i.path}: ${i.message}`);
    continue;
  }
  // 生成した C# をチェッカーにかける（対応表の args の名前や数の誤りはここで分かる）
  const chk = checkSource(code, `${wf.workflow}.cs`, ctx);
  const errs = chk.issues.filter((i) => i.severity === "error");
  if (errs.length) {
    failed = true;
    console.log(`NG ${f}（生成した C# がチェッカーを通らない）`);
    const lines = code.split(/\r?\n/);
    for (const i of errs) console.log(`  ${i.code.padEnd(20)} ${wf.workflow}.cs:${i.line}: ${i.message}\n  ${"".padEnd(20)} > ${lines[i.line - 1]?.trim()}`);
    continue;
  }
  if (print) { console.log(code); for (const s of subs) console.log(`<!-- ${s.file.path} -->\n${s.xaml}`); }
  const note = () => { for (const w of warns) console.log(`  ${w.code.padEnd(20)} ${w.path}: ${w.message}`); };
  if (checkOnly) { console.log(`OK ${f}`); note(); continue; }
  mkdirSync(outDir!, { recursive: true });
  const path = join(outDir!, `${wf.workflow}.cs`);
  writeFileSync(path, code, "utf8");
  for (const s of subs) {
    const xp = join(outDir!, s.file.kind === "activity" ? "_activities" : "_xaml", s.file.path.slice(s.file.path.lastIndexOf("/") + 1));
    mkdirSync(dirname(xp), { recursive: true });
    writeFileSync(xp, "﻿" + s.xaml, "utf8");
  }
  console.log(`OK ${f} -> ${path}${subs.length ? `（XAML 経由 ${subs.length} 件: ${subs.map((s) => s.file.path).join(", ")}）` : ""}`);
  note();
}
// traceLog の生成したコードが使う Steps（ログの書き方をそろえる部品）を、出力先に置く（tools/ir/templates/Steps.cs）
if (outDir && !checkOnly && !args.includes("--compact") && !args.includes("--no-trace-log") && Object.keys(labels).length > 0) {
  mkdirSync(outDir, { recursive: true });
  const tpl = readFileSync(join(dirname(fileURLToPath(import.meta.url)), "templates", "Steps.cs"), "utf8").replace(/^﻿/, "");
  writeFileSync(join(outDir, "Steps.cs"), tpl.replace(/__NAMESPACE__/g, ns), "utf8");
  console.log(`OK Steps.cs -> ${join(outDir, "Steps.cs")}`);
}
process.exit(failed ? 1 : 0);
