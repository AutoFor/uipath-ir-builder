// IR を検証して XAML を書き出す。
//
// 使い方:
//   node tools/ir/gen.ts samples/ir/Main.json [samples/ir/Sub.json ...] --out <UiPathプロジェクトのフォルダ>
//   node tools/ir/gen.ts samples/ir/Main.json --check   （検証だけ）
//   オプション:
//     --project <dir>       その UiPath プロジェクトの project.json の dependencies の版のカタログを使う。
//                           カタログに無い版はエラー（近い版を使わない）。ルートの imports もそのプロジェクトの main の XAML から取る。
//                           式の言語も project.json の expressionLanguage に従う
//     --imports-from <xaml> ルートの imports / AssemblyReference を、この XAML から取る（--project より優先）
//     --language <CSharp|VisualBasic>  式の言語（既定 VisualBasic）。C# では VB の式を C# に直して書く。直せない式は検証エラー（CS_EXPR）
//   どちらも無ければ、既定の版のカタログと BlankTemplate の imports を使う

import { readFileSync, writeFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { validate } from "./validate.ts";
import { generateChecked, type ExpressionLanguage } from "./generate.ts";
import { loadSelected, projectLanguage, projectRootImports, readRootImportsFile, runSelection, VersionError } from "./versions.ts";
import type { Workflow } from "./types.ts";
import { expandRefs } from "./objrepo.ts";

const root = join(dirname(fileURLToPath(import.meta.url)), "..", "..");

const args = process.argv.slice(2);
const outIdx = args.indexOf("--out");
const outDir = outIdx >= 0 ? args[outIdx + 1] : undefined;
const val = (k: string) => { const i = args.indexOf(k); return i >= 0 ? args[i + 1] : undefined; };
const project = val("--project");
const importsFrom = val("--imports-from");
const languageArg = val("--language");
const valued = new Set(["--out", "--project", "--imports-from", "--language"]);
const checkOnly = args.includes("--check");
// 横に置く付属ファイル（*.verify.json、*.expected.json）は IR ではないので飛ばす
export const isSidecar = (f: string) => /\.(verify|expected|args)\.json$/i.test(f);
const files = args.filter((a, i) => !a.startsWith("--") && !valued.has(args[i - 1]) && !isSidecar(a));
if (!files.length || (!outDir && !checkOnly) || (languageArg !== undefined && languageArg !== "CSharp" && languageArg !== "VisualBasic")) {
  console.error("使い方: node tools/ir/gen.ts <ir.json>... (--out <dir> | --check) [--project <dir>] [--imports-from <xaml>] [--language CSharp|VisualBasic]");
  process.exit(2);
}

const { cat, rootImports, language } = runSelection(() => {
  const { cat, warnings } = loadSelected(root, project);
  const imp = importsFrom ? { imports: readRootImportsFile(importsFrom), notes: [] as string[] } : project ? projectRootImports(project) : { imports: undefined, notes: [] as string[] };
  for (const w of [...warnings, ...imp.notes]) console.error(`注意: ${w}`);
  // --project があれば project.json の式の言語。--language と食い違えばエラー（どちらかを黙って捨てない）
  const fromProject = project ? projectLanguage(project) : undefined;
  if (fromProject && languageArg && fromProject !== languageArg) throw new VersionError(`--language ${languageArg} と ${project} の expressionLanguage（${fromProject}）が違う`);
  const language: ExpressionLanguage = fromProject ?? (languageArg as ExpressionLanguage | undefined) ?? "VisualBasic";
  return { cat, rootImports: imp.imports, language };
});
let failed = false;
for (const f of files) {
  // objs の { "$ref": ... }（オブジェクトリポジトリ）を、--project の .objects の中身にする
  const ex = expandRefs(JSON.parse(readFileSync(f, "utf8")) as Workflow, cat, project);
  const wf = ex.wf;
  let issues = ex.issues.length ? ex.issues : validate(wf, cat);
  // C# の式に直せないものも検証エラーとして出す（生成してみないと分からないので、--check でも生成する）
  const r = issues.length ? undefined : generateChecked(wf, cat, { rootImports, language });
  if (r) issues = r.issues;
  if (issues.length) {
    failed = true;
    console.log(`NG ${f}`);
    for (const i of issues) console.log(`  ${i.code.padEnd(18)} ${i.path}: ${i.message}`);
    continue;
  }
  if (checkOnly) { console.log(`OK ${f}`); continue; }
  const path = join(outDir!, `${wf.workflow}.xaml`);
  writeFileSync(path, "﻿" + r!.xaml, "utf8");
  console.log(`OK ${f} -> ${path}`);
}
process.exit(failed ? 1 : 0);
