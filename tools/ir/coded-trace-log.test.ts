// traceLog（generate-coded.ts）のテスト：操作の前後のログ・かかった秒数・場所（[ワークフロー > まとまり]）
import { test } from "node:test";
import assert from "node:assert/strict";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { loadSelected, runSelection } from "./versions.ts";
import { loadMappings } from "./mapping.ts";
import { generateCoded } from "./generate-coded.ts";
import type { Workflow } from "./types.ts";

const root = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const { cat } = runSelection(() => ({ cat: loadSelected(root, undefined, { coded: true }).cat }));
const { maps } = loadMappings(root);

const click = (name: string) => ({ act: "NClick", name, objs: { Target: { FullSelectorArgument: { lit: "<webctrl tag='A' />" } } } });
const card = (body: unknown[]) => ({ act: "NApplicationCard", name: "アプリ", objs: { TargetApp: { BrowserType: "Chrome", Selector: { lit: "<html app='chrome.exe' />" }, Url: { lit: "https://example.com" } } }, props: { CloseMode: "Never" }, body: [{ act: "Sequence", name: "実行", body }] });
const wf = {
  workflow: "TraceTest",
  body: [
    { act: "Sequence", name: "ログイン", body: [card([click("クリック 'A'")])] },
    { act: "Sequence", name: "ログイン", body: [card([click("クリック 'B'")])] },
  ],
} as unknown as Workflow;

test("traceLog：操作の前に「…始め」、後に「…終わり（n秒）」。遅ければ Warn", () => {
  const r = generateCoded(wf, cat, maps, { namespace: "P", traceLog: true });
  assert.deepEqual(r.issues, []);
  const c = r.code;
  const start = c.indexOf("クリック 'A' …始め");
  const call = c.indexOf(".Click(", start);
  const end = c.indexOf("クリック 'A' …終わり（", start);
  assert.ok(start > 0 && start < call && call < end, "始め → クリック → 終わり の順");
  assert.match(c, /var __sw\d+ = System\.Diagnostics\.Stopwatch\.StartNew\(\);/);
  assert.match(c, /__sw\d+\.Elapsed\.TotalSeconds >= 10 \? UiPath\.CodedWorkflows\.LogLevel\.Warn : UiPath\.CodedWorkflows\.LogLevel\.Trace/);
});

test("traceLog：画面を開く（スコープ）の「…終わり」は、本体の前に出す（本体の時間を含めない）", () => {
  const c = generateCoded(wf, cat, maps, { namespace: "P", traceLog: true }).code;
  const openEnd = c.indexOf("] アプリ …終わり（");
  const firstClick = c.indexOf("クリック 'A' …始め");
  assert.ok(openEnd > 0 && openEnd < firstClick);
  assert.ok(c.lastIndexOf("using (var", openEnd) > 0);
});

test("traceLog：場所は [ワークフロー > まとまり]。Studio の決まった名前（実行）は入れず、同じ名前が並ぶと（2回目）", () => {
  const c = generateCoded(wf, cat, maps, { namespace: "P", traceLog: true }).code;
  assert.match(c, /"\[TraceTest > ログイン > アプリ\] クリック 'A' …始め"/);
  assert.match(c, /"\[TraceTest > ログイン（2回目） > アプリ\] クリック 'B' …始め"/);
  assert.doesNotMatch(c, /> 実行/);
});

test("traceLog が無ければ、ログもストップウォッチも入れない", () => {
  const c = generateCoded(wf, cat, maps, { namespace: "P" }).code;
  assert.doesNotMatch(c, /Stopwatch|…始め/);
});
