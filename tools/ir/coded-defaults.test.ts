// 「IR に無い props」の意味が XAML と C# で同じこと。
//
// - 対応表の既定値（{Prop:-既定}、defaults）を、既定 XAML とカタログの DefaultValue と全部比べる。違うものは knowledge/coded-default-allow.json に理由が要る
// - 生成器の組み込み（RetryScope など）の既定値も比べる
// - 元の IR の C# と、その XAML を取り込んだ IR の C# は、順番と書き方のほかは同じ

import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { dirname, join, relative } from "node:path";
import { loadCatalog } from "./catalog.ts";
import { DEFAULT_CATALOG_FILES, sampleCatalogFiles } from "./versions.ts";
import { compareAll, compareMapping, loadAllow, rowKey } from "./coded-defaults.ts";
import { generateCoded } from "./generate-coded.ts";
import { CATALOG_FILES, importXaml, repoRoot as root, xamlDefaultProps } from "./import-xaml.ts";
import type { Mapping } from "./mapping.ts";
import { loadMappings } from "./mapping.ts";
import type { Workflow } from "./types.ts";

const cat = loadCatalog(root, CATALOG_FILES);
const { maps } = loadMappings(root);
const coded = (wf: Workflow) => generateCoded(wf, cat, maps, { namespace: "N" });
const act = (className: string) => cat.activities.find((a) => a.className === className)!;

test("対応表の既定値は、アクティビティの既定値と同じ（違うものは許可リストに理由がある）", () => {
  const rows = compareAll(cat, maps);
  const allow = loadAllow(root);
  assert.ok(rows.filter((r) => r.status === "ok").length > 100, "比べられた件数が少なすぎる（比較が壊れている）");
  const bad = rows.filter((r) => r.status !== "ok" && !allow[rowKey(r)]);
  assert.deepEqual(bad.map((r) => `${r.status} ${rowKey(r)} 既定: ${r.base ?? "?"}（${r.source ?? "-"}）`), [], "直すか、knowledge/coded-default-allow.json に理由を書く。一覧は node tools/ir/coded-defaults.ts");
});

test("許可リストに、もう要らないものや理由の無いものが残っていない", () => {
  const live = new Set(compareAll(cat, maps).filter((r) => r.status !== "ok").map(rowKey));
  for (const [k, why] of Object.entries(loadAllow(root))) {
    assert.ok(live.has(k), `${k} はもう食い違っていない。許可リストから消す`);
    assert.ok(why.trim().length > 0, `${k} に理由が無い`);
  }
});

test("比較：違う値、is_ の形、出力の捨て先、比べられない値", () => {
  const m = (coded: Mapping["coded"]): Mapping => ({ activity: "CopyChartToClipboardX", package: "UiPath.Excel.Activities", coded, file: "x" });
  const one = (tpl: string) => compareMapping(cat, m([{ code: tpl }]))[0];
  assert.equal(one("{ReplaceFile:-false}").status, "mismatch");
  assert.equal(one("{ReplaceFile:-true}").status, "ok");
  assert.equal(one("{Action|is_CopyToClipboard:-true}").status, "ok");
  assert.equal(one("{Action|is_CopyToClipboard:-false}").status, "mismatch");
  assert.equal(one("{FilePath:-null}").status, "ok", "既定が無く、対応表も「無し」なら問題ない");
  assert.equal(one("{FilePath:-\"a\"}").status, "unknown");
});

test("IR に無い props は、既定 XAML の値で C# を作る", () => {
  const wf: Workflow = { workflow: "W", variables: [{ name: "ch", type: "IChartRef" }], body: [{ act: "ExcelApplicationCard", item: "Excel", props: { WorkbookPath: { lit: "a.xlsx" } }, body: [
    { act: "CopyChartToClipboardX", props: { Chart: "ch", FilePath: { lit: "a.png" }, Action: "SaveAsPicture" } },
  ] }] };
  assert.match(coded(wf).code, /replaceFile: true/, "ReplaceFile は既定 XAML で True");
  assert.equal(xamlDefaultProps(cat, act("CopyChartToClipboardX")).ReplaceFile, true);
});

test("IR に書いた値は既定値より優先する", () => {
  const wf: Workflow = { workflow: "W", variables: [{ name: "ch", type: "IChartRef" }], body: [{ act: "ExcelApplicationCard", item: "Excel", props: { WorkbookPath: { lit: "a.xlsx" } }, body: [
    { act: "CopyChartToClipboardX", props: { Chart: "ch", FilePath: { lit: "a.png" }, Action: "SaveAsPicture", ReplaceFile: false } },
  ] }] };
  assert.match(coded(wf).code, /replaceFile: false/);
});

const chartNode = { act: "CopyChartToClipboardX", props: { Chart: "ch", FilePath: { lit: "a.png" } } };
const inCard = (node: Workflow["body"][number]): Workflow => ({ workflow: "W", variables: [{ name: "ch", type: "IChartRef" }], body: [{ act: "ExcelApplicationCard", item: "Excel", props: { WorkbookPath: { lit: "a.xlsx" } }, body: [node] }] });
const withVariants = (coded: Mapping["coded"]) => new Map(maps).set("UiPath.Excel.Activities/CopyChartToClipboardX", { ...maps.get("UiPath.Excel.Activities/CopyChartToClipboardX")!, coded });

test("形を選ぶ when は既定値も見る（既定値を書いても書かなくても同じ形）", () => {
  assert.match(generateCoded(inCard(chartNode), cat, withVariants([{ when: ["ReplaceFile"], code: "/*既定の形*/ {Chart}.A({FilePath});" }, { code: "/*別の形*/ {Chart}.B({FilePath});" }]), { namespace: "N" }).code, /既定の形/);
  assert.match(generateCoded(inCard(chartNode), cat, withVariants([{ when: ["ReplaceFile=False"], code: "/*False*/ {Chart}.A({FilePath});" }, { when: ["ReplaceFile=true"], code: "/*true*/ {Chart}.A({FilePath});" }, { code: "/*別の形*/ {Chart}.B({FilePath});" }]), { namespace: "N" }).code, /\/\*true\*\//);
});

test("既定値では「Coded API が無い」形を選ばない（IR に書いたときだけ）", () => {
  const m = withVariants([{ when: ["ReplaceFile"], reason: "API なし" }, { code: "/*使える形*/ {Chart}.A({FilePath});" }]);
  const r = generateCoded(inCard(chartNode), cat, m, { namespace: "N" });
  assert.deepEqual(r.issues, []);
  assert.match(r.code, /使える形/);
  const written = generateCoded(inCard({ ...chartNode, props: { ...chartNode.props, ReplaceFile: true } }), cat, m, { namespace: "N" });
  assert.deepEqual(written.issues.map((i) => i.code), ["NO_CODED_API"]);
});

test("IR に書かれた値を扱えない形は、既定値がそろっても選ばない", () => {
  const m = withVariants([{ when: ["ReplaceFile"], code: "/*一部しか使わない形*/ {Chart}.ToString();" }, { code: "{Chart}.Use({FilePath});" }]);
  const r = generateCoded(inCard(chartNode), cat, m, { namespace: "N" });
  assert.deepEqual(r.issues, []);
  assert.match(r.code, /\.Use\(/);
});

test("生成器の組み込みの既定値は、既定 XAML と同じ", () => {
  // generate-coded.ts の builtin が、IR に無いときに使う値（RepeatNumberOfTimesX.StartAt の 1）
  assert.equal(xamlDefaultProps(cat, act("RepeatNumberOfTimesX")).StartAt, 1);
  // RetryScope は既定 XAML に NumberOfRetries / RetryInterval が出ないので比べられない。出るようになったら builtin の 3 回・5 秒と比べる
  const retry = xamlDefaultProps(cat, act("RetryScope"));
  assert.equal(retry.NumberOfRetries, undefined);
  assert.equal(retry.RetryInterval, undefined);
});

// C# の順番と書き方の違いを消す（初期化子の順番、object / Object、decimal / Decimal、string[] / String[]、@"" / ""、Convert.ToString と .ToString）
function tokens(code: string): string[] {
  const t = code
    .replace(/@"((?:[^"]|"")*)"/g, (_, b: string) => `"${b.replace(/""/g, '\\"').replace(/\\(?!")/g, "\\\\")}"`)
    .replace(/\bnew Object\b/g, "new object").replace(/\bString\./g, "string.").replace(/\bDecimal\./g, "decimal.").replace(/<String>/g, "<string>").replace(/\bString\[\]/g, "string[]").replace(/\(String\)/g, "(string)").replace(/\bObject\b/g, "object")
    .replace(/Convert\.ToString\(/g, "(").replace(/\.ToString\(\)/g, "");
  const out: string[] = [];
  let cur = "", q = false;
  for (let i = 0; i < t.length; i++) {
    const c = t[i];
    if (c === '"' && t[i - 1] !== "\\") q = !q;
    if (!q && /[,(){};\s]/.test(c)) { if (cur) out.push(cur); cur = ""; } else cur += c;
  }
  if (cur) out.push(cur);
  return out.sort();
}

test("元の IR の C# と、取り込んだ IR の C# は、順番と書き方のほかは同じ", () => {
  const dir = join(root, "samples", "ir");
  const irs: string[] = [];
  const walk = (d: string) => { for (const e of readdirSync(d)) { const q = join(d, e); if (statSync(q).isDirectory()) walk(q); else if (e.endsWith(".json") && !/\.(verify|expected|args|types)\.json$/.test(e)) irs.push(q); } };
  walk(dir);
  let compared = 0;
  const diffs: string[] = [];
  for (const f of irs) {
    const wf = JSON.parse(readFileSync(f, "utf8").replace(/^﻿/, "")) as Workflow;
    if (!wf.workflow) continue;
    const xaml = join(root, "samples", "generated", dirname(relative(dir, f)), `${wf.workflow}.xaml`);
    if (!existsSync(xaml)) continue;
    // 既定の版に無いパッケージのサンプル（WebAPI など）は、このカタログでは読めない。往復は import-xaml.test.ts、C# は samples.test.ts が見る
    if (sampleCatalogFiles(root, relative(dir, f).split(/[\\/]/)[0]) !== DEFAULT_CATALOG_FILES) continue;
    const a = coded(wf);
    const r = importXaml(readFileSync(xaml, "utf8"), cat);
    if (!r.wf) continue;
    const b = coded(r.wf);
    if (a.issues.length || b.issues.length) {
      if (JSON.stringify(a.issues.map((i) => i.code)) !== JSON.stringify(b.issues.map((i) => i.code))) diffs.push(`${wf.workflow}: C# を作れるかが違う（元 ${a.issues.map((i) => i.code)} / 取り込み ${b.issues.map((i) => i.code)}）`);
      continue;
    }
    compared++;
    const x = tokens(a.code), y = tokens(b.code);
    if (JSON.stringify(x) !== JSON.stringify(y)) diffs.push(`${wf.workflow}: 元だけ ${x.filter((s) => !y.includes(s)).join(" ")} / 取り込みだけ ${y.filter((s) => !x.includes(s)).join(" ")}`);
  }
  assert.ok(compared > 300, `比べた件数が少なすぎる（${compared}）`);
  assert.deepEqual(diffs, []);
});
