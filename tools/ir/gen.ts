// IR を検証して XAML を書き出す。
//
// 使い方:
//   node tools/ir/gen.ts samples/ir/Main.json [samples/ir/Sub.json ...] --out <UiPathプロジェクトのフォルダ>
//   node tools/ir/gen.ts samples/ir/Main.json --check   （検証だけ）

import { readFileSync, writeFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { loadCatalog } from "./catalog.ts";
import { validate } from "./validate.ts";
import { generate } from "./generate.ts";
import type { Workflow } from "./types.ts";

const root = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const catalogFiles = [
  "catalog/System.Activities/6.0.0.json",
  "catalog/UiPath.System.Activities/26.10.0.json",
  "catalog/UiPath.UIAutomation.Activities/26.10.6.json",
  "catalog/UiPath.Excel.Activities/3.6.1.json",
  "catalog/UiPath.Persistence.Activities/1.13.0.json",
];

const args = process.argv.slice(2);
const outIdx = args.indexOf("--out");
const outDir = outIdx >= 0 ? args[outIdx + 1] : undefined;
const checkOnly = args.includes("--check");
// 横に置く付属ファイル（*.verify.json、*.expected.json）は IR ではないので飛ばす
export const isSidecar = (f: string) => /\.(verify|expected|args)\.json$/i.test(f);
const files = args.filter((a, i) => !a.startsWith("--") && (outIdx < 0 || i !== outIdx + 1) && !isSidecar(a));
if (!files.length || (!outDir && !checkOnly)) {
  console.error("使い方: node tools/ir/gen.ts <ir.json>... (--out <dir> | --check)");
  process.exit(2);
}

const cat = loadCatalog(root, catalogFiles);
let failed = false;
for (const f of files) {
  const wf: Workflow = JSON.parse(readFileSync(f, "utf8"));
  const issues = validate(wf, cat);
  if (issues.length) {
    failed = true;
    console.log(`NG ${f}`);
    for (const i of issues) console.log(`  ${i.code.padEnd(18)} ${i.path}: ${i.message}`);
    continue;
  }
  if (checkOnly) { console.log(`OK ${f}`); continue; }
  const path = join(outDir!, `${wf.workflow}.xaml`);
  writeFileSync(path, "﻿" + generate(wf, cat), "utf8");
  console.log(`OK ${f} -> ${path}`);
}
process.exit(failed ? 1 : 0);
