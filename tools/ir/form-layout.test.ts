// CreateFormTask の FormLayout の検証と FormLayoutGuid（AUT-1076、knowledge/persistence.md）

import { test } from "node:test";
import assert from "node:assert/strict";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { loadCatalog } from "./catalog.ts";
import { validate } from "./validate.ts";
import { generate } from "./generate.ts";
import { DEFAULT_CATALOG_FILES } from "./versions.ts";
import type { Workflow, Value } from "./types.ts";

const root = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const cat = loadCatalog(root, DEFAULT_CATALOG_FILES);

const wf = (name: string, layout?: Value): Workflow => ({
  workflow: name,
  arguments: [{ name: "in_Layout", dir: "In", type: "String" }],
  variables: [{ name: "t", type: "FormTaskData" }],
  body: [{ act: "CreateFormTask", props: { TaskTitle: { lit: "x" }, TaskPriority: "Low", ...(layout === undefined ? {} : { FormLayout: layout }), TaskOutput: "t" } }],
});
const codes = (w: Workflow) => validate(w, cat).map((i) => i.code);
const arr = JSON.stringify([{ type: "textfield", key: "A", label: "A", input: true }]);
const guid = (xaml: string) => /\sFormLayoutGuid="([^"]+)"/.exec(xaml)![1];

test("リテラルの配列は通る", () => assert.deepEqual(codes(wf("A1", { lit: arr })), []));
test("リテラルの空の配列も通る（形だけ見る）", () => assert.deepEqual(codes(wf("A2", { lit: "[]" })), []));
test("リテラルのオブジェクトは弾く", () => {
  assert.deepEqual(codes(wf("B1", { lit: '{"components":[]}' })), ["FORM_LAYOUT_NOT_ARRAY"]);
  assert.deepEqual(codes(wf("B2", { lit: '{"display":"form","components":[]}' })), ["FORM_LAYOUT_NOT_ARRAY"]);
});
test("リテラルが配列でない JSON（文字列、数、null）も弾く", () => {
  for (const l of ['"abc"', "1", "null", "true"]) assert.deepEqual(codes(wf("B3", { lit: l })), ["FORM_LAYOUT_NOT_ARRAY"], l);
});
test("リテラルが JSON として読めないものは弾く（空文字も）", () => {
  for (const l of ["", "[{", "not json"]) assert.deepEqual(codes(wf("C1", { lit: l })), ["FORM_LAYOUT_BAD_JSON"], JSON.stringify(l));
});
test("式（変数、VB の式、vb と cs）は中身を見ない", () => {
  assert.deepEqual(codes(wf("D1", "in_Layout")), []);
  assert.deepEqual(codes(wf("D2", "\"{\" & in_Layout & \"}\"")), []);
  assert.deepEqual(codes(wf("D3", { vb: "in_Layout", cs: "in_Layout" })), []);
});
test("FormLayout が無いと弾く", () => assert.deepEqual(codes(wf("E1")), ["FORM_LAYOUT_MISSING"]));

test("FormLayoutGuid：同じ入力からは同じ、レイアウトが変われば別、ワークフロー名が変われば別", () => {
  const a = guid(generate(wf("G1", { lit: arr }), cat));
  assert.equal(a, guid(generate(wf("G1", { lit: arr }), cat)));
  assert.notEqual(a, guid(generate(wf("G1", { lit: JSON.stringify([{ type: "textfield", key: "B" }]) }), cat)));
  assert.notEqual(a, guid(generate(wf("G2", { lit: arr }), cat)));
  assert.match(a, /^[0-9a-f]{8}-[0-9a-f]{4}-5[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
});
test("FormLayoutGuid：式のときは今までどおり（ワークフロー名と通し番号だけ）", () => {
  const a = guid(generate(wf("H1", "in_Layout"), cat));
  assert.equal(a, guid(generate(wf("H1", { vb: "in_Layout + \"x\"", cs: "in_Layout + \"x\"" }), cat)));
});
test("ほかの GUID（BulkFormLayoutGuid）はレイアウトで変わらない", () => {
  const bulk = (x: string) => /BulkFormLayoutGuid="([^"]+)"/.exec(x)![1];
  assert.equal(bulk(generate(wf("I1", { lit: arr }), cat)), bulk(generate(wf("I1", { lit: "[]" }), cat)));
});
