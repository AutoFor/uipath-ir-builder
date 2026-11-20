import { strict as assert } from "node:assert";
import { test } from "node:test";
import type { Workflow } from "../ir/types.ts";
import { irToPlaywright } from "./ir-to-pw.ts";
import { keysToUiPath, splitTrailingKeys } from "./keys.ts";
import { convert, type Recording, type Snapshot } from "./record-to-ir.ts";

test("キーの名前を UiPath の [k(…)] にし、後ろから戻す", () => {
  assert.equal(keysToUiPath(["Tab", "Tab", "Enter", "Space"]), "[k(tab)][k(tab)][k(enter)] ");
  assert.deepEqual(splitTrailingKeys("abc[k(tab)][k(tab)] "), { text: "abc", keys: ["Tab", "Tab", "Space"] });
  // [k(…)] の無い後ろの空白は、キーにしない
  assert.deepEqual(splitTrailingKeys("abc "), { text: "abc ", keys: [] });
  assert.throws(() => keysToUiPath(["F13"]), /F13/);
  assert.deepEqual(splitTrailingKeys("abc[k(tab)][k(enter)]"), { text: "abc", keys: ["Tab", "Enter"] });
  assert.deepEqual(splitTrailingKeys("abc"), { text: "abc", keys: [] });
  // 知らないキーがあれば分けない（文字のまま入れる）
  assert.deepEqual(splitTrailingKeys("abc[k(zzz)]"), { text: "abc[k(zzz)]", keys: [] });
});

const snap: Snapshot = { tag: "AP-TEXT-FIELD", attrs: { label: "確定" }, text: "", value: null, role: null, css: "ap-text-field", ancestors: [], counts: { "#tag": 1 }, inShadow: false, inFrame: false };
const rec = (valueArg?: string): Recording => ({
  version: 1, locale: "ja-JP",
  steps: [
    { i: 0, action: "goto", screen: "一覧", url: "https://example.test/list", page: { url: "https://example.test/list", title: "t", lang: "ja" } },
    { i: 1, action: "fill", screen: "一覧", name: "確定の欄", value: "ircu-x", valueArg, keys: ["Tab", "Tab", "Enter"], element: snap },
  ],
});
type N = { act?: string; props?: { Text?: unknown }; body?: N[] };
const find = (ns: N[]): N | undefined => { for (const n of ns) { if (n.act === "NTypeInto") return n; const c = find(n.body ?? []); if (c) return c; } return undefined; };
const typeInto = (r: Recording) => find(convert([r], { workflow: "W", app: "A", browser: "Chrome" }).ir.body as N[])!;

test("記録の fill のキーは、Type Into の文字の後ろに [k(…)] で足す（リテラルと引数）", () => {
  assert.deepEqual(typeInto(rec()).props!.Text, { lit: "ircu-x[k(tab)][k(tab)][k(enter)]" });
  assert.equal(typeInto(rec("in_Name")).props!.Text, 'in_Name + "[k(tab)][k(tab)][k(enter)]"');
});

test("Type Into の後ろの [k(…)] は、Playwright では fill のあとの keyboard.press になる", () => {
  const T = { FullSelectorArgument: { lit: "<webctrl tag='INPUT' id='c' />" }, SearchSteps: "Selector" };
  for (const Text of [{ lit: "ircu-x[k(tab)][k(enter)]" }, 'in_Name + "[k(tab)][k(enter)]"', 'in_Name + "[k(tab)][k(enter)] "']) {
    const w: Workflow = { workflow: "K", arguments: [{ name: "in_Name", dir: "In", type: "String" }], body: [{ act: "NTypeInto", objs: { Target: T }, props: { Text } }] } as Workflow;
    const code = irToPlaywright(w, undefined).code;
    assert.match(code, /\.fill\((?:"ircu-x"|args\.in_Name|in_Name)\);\n\s*await page\.keyboard\.press\("Tab"\);\n\s*await page\.keyboard\.press\("Enter"\);/, code);
  }
});
