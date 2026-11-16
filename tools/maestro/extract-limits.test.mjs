// node --test tools/maestro/extract-limits.test.mjs
import { test } from "node:test";
import assert from "node:assert/strict";
import { extractLimitIssues } from "./extract-limits.mjs";

const flow = (props) => JSON.stringify({ nodes: [{ id: "extract1", inputs: { schemaDocument: { outputSchema: { type: "object", properties: props } } } }] });
const fields = (n, extra = {}) => Object.fromEntries(Array.from({ length: n }, (_, i) => [`f${i}`, { description: "x", ...extra }]));

test("上限の内なら何も出さない", () => {
  assert.deepEqual(extractLimitIssues(flow({ Invoice: { type: ["object", "null"], properties: fields(32) } })), []);
});

test("項目 33 個・長い名前・長い指示を見つける。繰り返しのグループ（items.properties）も見る", () => {
  const long = "n".repeat(65);
  const issues = extractLimitIssues(flow({
    Invoice: { type: ["object", "null"], properties: fields(33) },
    Lines: { type: "array", items: { properties: { [long]: { description: "d".repeat(4097) } } } },
  }));
  assert.deepEqual(issues.map((i) => i.where), ["extract1.Invoice", `extract1.Lines.${long}`, `extract1.Lines.${long}`]);
});

test("schemaDocument が文字列でも読む。Extract の無い flow と壊れた JSON は空", () => {
  const text = JSON.stringify({ nodes: [{ id: "e", inputs: { schemaDocument: JSON.stringify({ outputSchema: { properties: { G: { properties: fields(40) } } } }) } }] });
  assert.equal(extractLimitIssues(text).length, 1);
  assert.deepEqual(extractLimitIssues(JSON.stringify({ nodes: [{ id: "s", inputs: {} }] })), []);
  assert.deepEqual(extractLimitIssues("{"), []);
});
