// 式の言語が VB の XAML を、C# の XAML に作り直す。import-xaml.ts で IR に読み、generate.ts で C# の式にして書く。
//
//   node tools/ir/convert-xaml.ts <in.xaml>... --to CSharp --out <dir> [--project <dir>]
//     --to CSharp      変換先の式の言語（今は CSharp だけ）
//     --out <dir>      <dir>/<workflow>.xaml に書く
//     --project <dir>  その UiPath プロジェクトの版のカタログを使う（gen.ts の --project と同じ）。ルートの imports もそのプロジェクトから取る
//   終了コード: 0 = すべて変換できた / 1 = 変換できないものがある / 2 = 使い方の誤り
//
// - 取り込めない XAML（Flowchart など。import-xaml.ts の errors）と、C# に直せない式（CS_EXPR）は変換しない。
//   C# に直せない式は、import-xaml.ts --out で IR にしてから、その値を { "vb": "...", "cs": "..." } に直して gen.ts --language CSharp で作る
// - ルートの imports / AssemblyReference は元の XAML のものを残し、C# の BlankTemplate にあるもの（Microsoft.CSharp、System.Text など）を足す
// - C# → VB はできない。import-xaml.ts が CSharpValue / CSharpReference を読めない（C# の式を VB に直す変換も無い）

import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { droppedSummary, importAndCheck, type ImportIssue } from "./import-xaml.ts";
import { generateChecked, templateRootImports } from "./generate.ts";
import { loadSelected, projectRootImports, readRootImports, runSelection } from "./versions.ts";

const root = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const args = process.argv.slice(2);
const val = (k: string) => { const i = args.indexOf(k); return i >= 0 ? args[i + 1] : undefined; };
const to = val("--to");
const outDir = val("--out");
const project = val("--project");
const valued = new Set(["--to", "--out", "--project"]);
const files = args.filter((a, i) => !a.startsWith("--") && !valued.has(args[i - 1]));
if (!files.length || !outDir || !to) {
  console.error("使い方: node tools/ir/convert-xaml.ts <in.xaml>... --to CSharp --out <dir> [--project <dir>]");
  process.exit(2);
}
if (to !== "CSharp") {
  console.error(to === "VisualBasic"
    ? "C# → VB はできない。import-xaml.ts が C# の式（CSharpValue / CSharpReference）を読めず、C# の式を VB に直す変換も無い"
    : `--to ${to} は扱えない（CSharp だけ）`);
  process.exit(2);
}

const { cat, projectImports } = runSelection(() => {
  const { cat, warnings } = loadSelected(root, project);
  const imp = project ? projectRootImports(project) : { imports: undefined, notes: [] as string[] };
  for (const w of [...warnings, ...imp.notes]) console.error(`注意: ${w}`);
  return { cat, projectImports: imp.imports };
});

const line = (i: ImportIssue) => `  ${i.code.padEnd(26)} ${i.path}: ${i.message}`;
let failed = false;
mkdirSync(outDir, { recursive: true });
for (const f of files) {
  if (!existsSync(f)) { console.log(`NG ${f}: ファイルが無い`); failed = true; continue; }
  const xml = readFileSync(f, "utf8");
  const r = importAndCheck(xml, cat);
  if (!r.wf || r.errors.length || r.validation.length) {
    failed = true;
    console.log(`NG ${f}: 取り込めない`);
    for (const i of r.errors) console.log(`  エラー ${line(i)}`);
    for (const i of r.validation) console.log(`  検証 ${line(i)}`);
    continue;
  }
  // 元の imports を残し、C# のテンプレートにあるものを後ろに足す（Microsoft.CSharp はテンプレートと同じく先頭）
  const cs = templateRootImports("CSharp");
  const src = readRootImports(xml);
  const rootImports = projectImports ?? (src ? { imports: [...new Set([...src.imports, ...cs.imports])], refs: [...new Set(["Microsoft.CSharp", ...src.refs, ...cs.refs])] } : cs);
  const g = generateChecked(r.wf, cat, { language: "CSharp", rootImports });
  if (g.issues.length) {
    failed = true;
    console.log(`NG ${f}: C# に直せない式がある（import-xaml.ts --out で IR にして、その値を { "vb": "...", "cs": "..." } に直す）`);
    for (const i of g.issues) console.log(`  ${i.code.padEnd(18)} ${i.path}: ${i.message}`);
    continue;
  }
  const path = join(outDir, `${r.wf.workflow}.xaml`);
  writeFileSync(path, "﻿" + g.xaml, "utf8");
  console.log(`OK ${f} -> ${path}${r.roundTrip && !r.roundTrip.sameMeaning ? "（取り込みで違いあり。警告を見る）" : ""}`);
  // 取り込みで落ちたもの・変わるかもしれないもの（C# にしても戻らない）
  for (const i of r.warnings) console.log(`  警告 ${line(i)}`);
  for (const s of droppedSummary(r.dropped)) if (!["IdRef", "ViewState", "GUID", "既定値", "値なし"].includes(s.kind)) console.log(`  捨てた ${s.kind}: ${s.count} 件（${s.examples.join(", ")}）`);
}
process.exit(failed ? 1 : 0);
