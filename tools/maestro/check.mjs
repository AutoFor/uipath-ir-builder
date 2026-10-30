// 試作の通し検証（ローカルだけ。アップロードも実行もしない）：
//   IR → SDK のソース → check → compile → uip の validate、SDK を使わない BPMN → format → validate、Case → check → compile → validate
//
// 準備: cd tools/maestro && npm install --ignore-scripts
// 使い方: node tools/maestro/check.mjs     （結果は out/maestro/）

import { spawnSync } from "node:child_process";
import { copyFileSync, mkdirSync, rmSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, "..", "..");
const out = join(root, "out", "maestro");
const uipJs = join(process.env.APPDATA ?? "", "npm", "node_modules", "@uipath", "cli", "dist", "index.js");
rmSync(out, { recursive: true, force: true });
mkdirSync(out, { recursive: true });

let failed = 0;
// uip は呼び出し元のフォルダから SDK を探すので、cwd は tools/maestro
function step(label, args, runner = "uip") {
  const r = runner === "uip"
    ? spawnSync(process.execPath, [uipJs, ...args, "--output", "json"], { cwd: here, encoding: "utf8" })
    : spawnSync(process.execPath, args, { cwd: root, encoding: "utf8" });
  const ok = r.status === 0;
  if (!ok) failed++;
  console.log(`${ok ? "OK" : "NG"}  ${label}`);
  if (!ok) {
    const text = (r.stdout + r.stderr).split(/\r?\n/).filter((l) => !/ManifestClient|case-mgmt/.test(l)).join("\n");
    console.log(text.slice(0, 1800));
  }
  return r;
}
const p = (name) => join(out, name);

for (const name of ["Minimal", "ExpenseApproval"]) {
  step(`gen ${name}`, [join(here, "gen.ts"), join(root, "samples", "maestro", `${name}.json`), "--out", out], "node");
  step(`flow check ${name}`, ["maestro", "flow", "check", p(`${name}.flow.ts`), "--source"]);
  step(`flow compile ${name}`, ["maestro", "flow", "compile", p(`${name}.flow.ts`), "-o", p(`${name}.flow`)]);
  step(`flow validate ${name}`, ["maestro", "flow", "validate", p(`${name}.flow`)]);
  step(`bpmn check ${name}`, ["maestro", "bpmn", "check", p(`${name}.bpmn.ts`), "--source"]);
  step(`bpmn compile ${name}`, ["maestro", "bpmn", "compile", p(`${name}.bpmn.ts`), "-o", p(`${name}.bpmn`)]);
  step(`bpmn format ${name}`, ["maestro", "bpmn", "format", p(`${name}.bpmn`)]);
  step(`bpmn validate ${name}`, ["maestro", "bpmn", "validate", p(`${name}.bpmn`)]);
}

step("gen Minimal（SDK なし）", [join(here, "gen.ts"), join(root, "samples", "maestro", "Minimal.json"), "--out", out, "--direct"], "node");
step("bpmn format Minimal（SDK なし）", ["maestro", "bpmn", "format", p("Minimal.direct.bpmn")]);
step("bpmn validate Minimal（SDK なし）", ["maestro", "bpmn", "validate", p("Minimal.direct.bpmn")]);

copyFileSync(join(root, "samples", "maestro", "ExpenseCase.case.ts"), p("ExpenseCase.case.ts"));
step("case check ExpenseCase", ["maestro", "case", "check", p("ExpenseCase.case.ts"), "--source"]);
step("case compile ExpenseCase", ["maestro", "case", "compile", p("ExpenseCase.case.ts"), "-o", p("ExpenseCase.json")]);
step("case validate ExpenseCase", ["maestro", "case", "validate", p("ExpenseCase.json"), "--strict"]);

console.log(failed ? `NG ${failed} 件` : "すべて OK");
process.exit(failed ? 1 : 0);
