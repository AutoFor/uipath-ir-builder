// IR から既定値と同じ props を落とす（slim.ts）のテスト
import { test } from "node:test";
import assert from "node:assert/strict";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { loadSelected, runSelection } from "./versions.ts";
import { slimByCoded, slimByDefaults } from "./slim.ts";
import type { Workflow } from "./types.ts";

const root = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const cat = runSelection(() => loadSelected(root, undefined, { coded: true }).cat);
const wf = (): Workflow => ({
  workflow: "SlimTest",
  body: [{ act: "NClick", name: "クリック", props: { ClickType: "Single", InteractionMode: "SameAsCard", MouseButton: "Right" } }],
} as unknown as Workflow);

test("既定 XAML と同じもの（ClickType=Single）だけを落とす。既定が分からないもの・違う値は残す", () => {
  const hits = slimByDefaults(wf(), cat);
  assert.deepEqual(hits.map((h) => `${h.prop}:${h.why}`), ["ClickType:既定 XAML"]);
});

test("--coded：消しても C# が同じものだけを落とし、変わるものは戻す", () => {
  const w = wf();
  // 生成の代わり：MouseButton だけが出力に効く
  const gen = (x: Workflow) => JSON.stringify((x.body[0] as { props?: Record<string, unknown> }).props?.MouseButton ?? null);
  const hits = slimByCoded(w, cat, gen);
  assert.deepEqual(hits.map((h) => h.prop).sort(), ["ClickType", "InteractionMode"]);
  assert.deepEqual((w.body[0] as { props?: Record<string, unknown> }).props, { MouseButton: "Right" });
});
