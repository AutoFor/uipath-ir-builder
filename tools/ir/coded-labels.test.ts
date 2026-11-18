// Coded のオプションを1行に1つ書き、行末に Studio の日本語の名前を付ける（generate-coded.ts の labels）のテスト
import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { loadSelected, runSelection } from "./versions.ts";
import { loadMappings } from "./mapping.ts";
import { generateCoded } from "./generate-coded.ts";
import type { Workflow } from "./types.ts";

const root = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const { cat, files } = runSelection(() => { const s = loadSelected(root, undefined, { coded: true }); return { cat: s.cat, files: s.selection.files }; });
const { maps } = loadMappings(root);
const labels: Record<string, string> = {};
for (const f of files) { const j = join(root, f.replace(/(\.portable)?\.json$/, ".ja.json")); if (existsSync(j)) Object.assign(labels, JSON.parse(readFileSync(j, "utf8"))); }

const wf = {
  workflow: "LabelTest",
  body: [{ act: "NApplicationCard", name: "アプリ", objs: { TargetApp: { BrowserType: "Chrome", Selector: { lit: "<html app='chrome.exe' />" }, Url: { lit: "https://example.com" } } }, props: { CloseMode: "Never" },
    body: [{ act: "NClick", name: "クリック", objs: { Target: { FullSelectorArgument: { lit: "<webctrl tag='A' />" } } }, props: { InteractionMode: "DebuggerApi", ClickType: "Double" } }] }],
} as unknown as Workflow;

test("labels があれば、オプションは1行に1つで、行末に日本語の名前。既定と同じ値は書かない", (t) => {
  if (!Object.keys(labels).length) return t.skip("この版の .ja.json が無い");
  const r = generateCoded(wf, cat, maps, { namespace: "P", labels });
  assert.deepEqual(r.issues, []);
  assert.match(r.code, /\r?\n\s+CloseMode = NAppCloseMode\.Never, \/\/ クローズ動作\r?\n/);
  assert.match(r.code, /\r?\n\s+InteractionMode = NChildInteractionMode\.DebuggerApi, \/\/ 入力モード\r?\n/);
  assert.match(r.code, /ClickType = NClickType\.Double, \/\/ /);
  assert.doesNotMatch(r.code, /MouseButton/); // 既定（Left）は書かない
});

test("labels が無ければ、これまでどおり1行にまとめる", () => {
  const r = generateCoded(wf, cat, maps, { namespace: "P" });
  assert.match(r.code, /new ClickOptions \{ [^\n]*InteractionMode = [^\n]*\}/);
});

test("splitCall：行の最後の呼び出しを、かっこ・文字列の中のカンマで切らずに分ける", async () => {
  const { splitCall } = await import("./generate-coded.ts");
  const r = splitCall(`(a, b) = system.GetCredential(assetName: {AssetName}, folderPath: "x, y", f: G(1, 2));`);
  assert.deepEqual(r, { head: "(a, b) = system.GetCredential", args: ["assetName: {AssetName}", 'folderPath: "x, y"', "f: G(1, 2)"], tail: ";" });
  assert.equal(splitCall("var x = 1;"), undefined);
});
