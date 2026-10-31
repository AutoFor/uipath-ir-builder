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
//                          カタログに無い版、services の無い古いカタログはエラー

import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { validate } from "./validate.ts";
import { generateCoded } from "./generate-coded.ts";
import { loadMappings } from "./mapping.ts";
import { checkSource, loadContext } from "../coded/check.ts";
import { loadSelected, runSelection } from "./versions.ts";
import type { Workflow } from "./types.ts";

const root = join(dirname(fileURLToPath(import.meta.url)), "..", "..");

const args = process.argv.slice(2);
const val = (k: string) => { const i = args.indexOf(k); return i >= 0 ? args[i + 1] : undefined; };
const outDir = val("--out");
const project = val("--project");
const invokeDir = val("--invoke-dir");
const checkOnly = args.includes("--check");
const print = args.includes("--print");
const valued = new Set(["--out", "--namespace", "--invoke-dir", "--project"]);
const files = args.filter((a, i) => !a.startsWith("--") && !valued.has(args[i - 1]) && !/\.(verify|expected|args)\.json$/i.test(a));
if (!files.length || (!outDir && !checkOnly)) {
  console.error("使い方: node tools/ir/gen-coded.ts <ir.json>... (--out <dir> | --check) [--namespace <名前>] [--invoke-dir <dir>] [--print] [--project <dir>]");
  process.exit(2);
}

const { cat, ctx } = runSelection(() => {
  const { cat, warnings } = loadSelected(root, project, { coded: true });
  for (const w of warnings) console.error(`注意: ${w}`);
  return { cat, ctx: loadContext(project) };
});
const { maps, errors: mapErrors } = loadMappings(root);
if (mapErrors.length) { for (const e of mapErrors) console.log(`対応表のエラー: ${e}`); process.exit(1); }
const ns = val("--namespace") ?? ctx.namespace;
ctx.namespace = ns;

let failed = false;
for (const f of files) {
  const wf: Workflow = JSON.parse(readFileSync(f, "utf8").replace(/^﻿/, ""));
  const issues = validate(wf, cat);
  let code = "";
  if (!issues.length) {
    const r = generateCoded(wf, cat, maps, { namespace: ns, invokePath: invokeDir ? (p) => p.replace(/^(.*?)([^\\/]+)\.xaml$/i, `${invokeDir}/$2.cs`) : undefined });
    issues.push(...r.issues);
    code = r.code;
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
  if (print) console.log(code);
  if (checkOnly) { console.log(`OK ${f}`); continue; }
  mkdirSync(outDir!, { recursive: true });
  const path = join(outDir!, `${wf.workflow}.cs`);
  writeFileSync(path, code, "utf8");
  console.log(`OK ${f} -> ${path}`);
}
process.exit(failed ? 1 : 0);
