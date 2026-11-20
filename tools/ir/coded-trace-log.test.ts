// traceLog（generate-coded.ts）のテスト：ログは Steps（tools/ir/templates/Steps.cs）を通して出す
// - ワークフローの中身を Steps.Workflow で包む（始め・終わり・秒数、場所の道すじ）
// - 1つの操作は Steps.Op / 呼び出しは Steps.Call（始め）と .Ok()（終わり）
// - LogMessage は Steps.Log（[場所] を付ける）
// - 手順名は日本語にそろえる（Check App State → 状態を確認 など）
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { loadSelected, runSelection } from "./versions.ts";
import { loadMappings } from "./mapping.ts";
import { generateCoded, stepName } from "./generate-coded.ts";
import type { Workflow } from "./types.ts";

const root = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const { cat } = runSelection(() => ({ cat: loadSelected(root, undefined, { coded: true }).cat }));
const { maps } = loadMappings(root);

const click = (name: string) => ({ act: "NClick", name, objs: { Target: { FullSelectorArgument: { lit: "<webctrl tag='A' />" } } } });
const card = (body: unknown[], openMode?: string) => ({ act: "NApplicationCard", name: "アプリ", objs: { TargetApp: { BrowserType: "Chrome", Selector: { lit: "<html app='chrome.exe' />" }, Url: { lit: "https://example.com" } } }, props: { CloseMode: "Never", ...(openMode ? { OpenMode: openMode } : {}) }, body: [{ act: "Sequence", name: "実行", body }] });
const wf = {
  workflow: "TraceTest",
  body: [
    { act: "Sequence", name: "ログイン", body: [{ act: "LogMessage", props: { Message: { lit: "メモ" } } }, card([click("Click 'A'")], "Never")] },
    { act: "Sequence", name: "ログイン", body: [card([click("クリック 'B'")])] },
  ],
} as unknown as Workflow;
const gen = (traceLog = true) => generateCoded(wf, cat, maps, { namespace: "P", traceLog });

test("traceLog：中身を Steps.Workflow で包み、最後に Ok", () => {
  const r = gen();
  assert.deepEqual(r.issues, []);
  assert.match(r.code, /using var __wf = Steps\.Workflow\(\(m, l\) => Log\(m, l\), "TraceTest"\);/);
  const ok = r.code.lastIndexOf("__wf.Ok();");
  assert.ok(ok > r.code.lastIndexOf(".Click("), "最後の操作のあとに Ok");
});

test("traceLog：操作の前に Steps.Op、後に .Ok()。画面を開く（スコープ）の Ok は本体の前", () => {
  const c = gen().code;
  const start = c.indexOf(`Steps.Op("ログイン > アプリ", "クリック 'A'")`);
  const call = c.indexOf(".Click(", start);
  const end = c.indexOf(".Ok();", call);
  assert.ok(start > 0 && start < call && call < end, "Op → クリック → Ok の順");
  const open = c.indexOf(`Steps.Op("ログイン", "画面に付く 'アプリ'")`);
  const openOk = c.indexOf(".Ok();", open);
  assert.ok(open > 0 && openOk < start, "画面に付くの Ok は、中のクリックより前");
  assert.match(c, /Steps\.Op\("ログイン（2回目）", "画面を開く 'アプリ'"\)/, "OpenMode が Never でなければ「画面を開く」、同じ名前が並ぶと（2回目）");
  assert.doesNotMatch(c, /Stopwatch|…始め/, "秒数や始め・終わりの文言は Steps が持つ");
});

test("traceLog：LogMessage は Steps.Log で場所を付ける", () => {
  assert.match(gen().code, /Steps\.Log\("ログイン", "メモ", UiPath\.CodedWorkflows\.LogLevel\.Info\);/);
});

test("traceLog が無ければ、Steps も使わない", () => {
  const c = gen(false).code;
  assert.doesNotMatch(c, /Steps\./);
  assert.match(c, /Log\(message: "メモ"/);
});

test("stepName：Studio の既定の英語の名前を日本語にそろえる（対象の名前はそのまま）", () => {
  assert.equal(stepName("Check App State 'メンテナンス中'", "NCheckState"), "状態を確認 'メンテナンス中'");
  assert.equal(stepName("Click 'Verify'", "NClick"), "クリック 'Verify'");
  assert.equal(stepName("Type Into 'INPUT email_otp'", "NTypeInto"), "文字を入力 'INPUT email_otp'");
  assert.equal(stepName("Delay", "Delay"), "待機");
  assert.equal(stepName("クリック '口座'", "NClick"), "クリック '口座'");
  assert.equal(stepName(undefined, "Delay"), "Delay");
  assert.equal(stepName("Clicker", "NClick"), "Clicker", "単語の途中では変えない");
});

test("テンプレートの Steps.cs：名前空間の置き場所と、決まりの値", () => {
  const t = readFileSync(join(root, "tools", "ir", "templates", "Steps.cs"), "utf8");
  assert.match(t, /namespace __NAMESPACE__/);
  assert.match(t, /SlowSeconds = 10/);
  assert.match(t, /PlaceDepth = 3/);
  assert.match(t, /…始め/);
  assert.match(t, /…終わり（\{Seconds:0\.0\}秒）/);
  assert.match(t, /…中断（/);
  assert.match(t, /quiet: name\.Contains\("\.cs'"\)/, "Coded の呼び出しは呼んだ先に始め・終わりを任せる");
});
