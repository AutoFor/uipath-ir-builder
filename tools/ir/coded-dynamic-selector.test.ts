// リポジトリの要素でも、セレクターが C# の式（リポジトリの変数を差し込むもの）なら Descriptors を使わない（generate-coded.ts）
// Coded の Descriptors はリポジトリの変数を受け取れず、変数の名前がそのまま入る（moneyforward_cs の MF入力：aaname='支出元*' で見つからず本番で落ちた）
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
const descriptors = new Map([
  ["LIB/select", { path: "Descriptors.App.Form.支出元", kind: "element" as const, namespace: "P" }],
  ["LIB/option", { path: "Descriptors.App.Form.支出元.ds_支出元", kind: "element" as const, namespace: "P" }],
]);
const click = (name: string, target: Record<string, unknown>) => ({ act: "NClick", name, objs: { Target: { SearchSteps: "Selector", ...target } } });
const wf = {
  workflow: "DynTest",
  vars: [{ name: "支出元", type: "String" }],
  body: [{
    act: "NApplicationCard", name: "アプリ",
    objs: { TargetApp: { BrowserType: "Chrome", Selector: { lit: "<html app='chrome.exe' />" }, Url: { lit: "https://example.com" } } },
    props: { CloseMode: "Never", OpenMode: "Never" },
    body: [{ act: "Sequence", name: "実行", body: [
      click("クリック '支出元'", { Reference: { lit: "LIB/select" }, FullSelectorArgument: { lit: "<webctrl tag='SELECT' />" } }),
      click("クリック 'ds_支出元'", { Reference: { lit: "LIB/option" }, FullSelectorArgument: { cs: "string.Format(\"<webctrl tag='SELECT' /><webctrl tag='OPTION' aaname='{0}*' />\", 支出元)" } }),
    ] }],
  }],
} as unknown as Workflow;

test("セレクターが文字列なら Descriptors、C# の式なら TargetAnchorableModel { PartialSelector = 式 }（Reference は付けない）", () => {
  const r = generateCoded(wf, cat, maps, { namespace: "P", descriptors });
  assert.deepEqual(r.issues, []);
  assert.match(r.code, /Click\(Descriptors\.App\.Form\.支出元\)/, "文字列のセレクターはリポジトリのまま");
  assert.doesNotMatch(r.code, /Descriptors\.App\.Form\.支出元\.ds_支出元/, "式のセレクターは Descriptors にしない");
  const m = r.code.match(/new TargetAnchorableModel \{.*$/m); // 文字列の中に { } があるので、行の終わりまで
  assert.ok(m, "TargetAnchorableModel で渡す");
  assert.match(m[0], /PartialSelector = string\.Format\("<webctrl tag='SELECT' \/><webctrl tag='OPTION' aaname='\{0\}\*' \/>", 支出元\)/);
  assert.doesNotMatch(m[0], /Reference/, "Reference があるとリポジトリの（変数の入っていない）セレクターが使われるおそれ");
});
