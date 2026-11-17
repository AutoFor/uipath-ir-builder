// Studio のフォーム（.uiform / HTML）の検査と、IR の FormId の突き合わせ（AUT-1209、knowledge/forms.md）

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { checkHtmlForm, checkUiForm, checkWorkflowRefs, scanProject } from "./forms.ts";
import type { Workflow } from "./types.ts";

const root = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const ID = "6f0c2a3e-9b1d-4c58-a7e2-1f3b5d7c9a01";
const form = (components: unknown[], md: Record<string, unknown> = { Id: ID, Kind: "FormIo" }) => ({ Metadata: md, DesignProperties: { Title: "t" }, Data: { display: "form", components } });
const codes = (r: { issues: { code: string }[] }) => r.issues.map((i) => i.code);

test("見本のフォーム（samples/data/forms）は通り、見本の IR の FormId・key・イベントはすべて見つかる", () => {
  const { forms, issues } = scanProject(join(root, "samples", "data", "forms"));
  assert.deepEqual(issues, []);
  assert.equal(forms.length, 2);
  const dir = join(root, "samples", "ir", "UiPath.Form.Activities");
  for (const f of readdirSync(dir).filter((x) => x.endsWith(".json") && !x.endsWith(".verify.json"))) {
    const wf = JSON.parse(readFileSync(join(dir, f), "utf8")) as Workflow;
    assert.deepEqual(checkWorkflowRefs(wf, f, forms), [], f);
  }
});

test(".uiform：部品の key とイベント名を出す（ボタンは <key>.click、値は <key>.changed、入れ子もたどる）", () => {
  const r = checkUiForm("a.uiform", form([
    { type: "textfield", key: "name" },
    { type: "columns", key: "cols", columns: [{ components: [{ type: "number", key: "n" }] }, { components: [{ type: "button", key: "go", action: "event" }] }] },
  ]));
  assert.deepEqual(codes(r), []);
  assert.deepEqual(r.info!.keys, ["name", "n"]);
  assert.ok(r.info!.events.includes("go.click") && r.info!.events.includes("n.changed") && r.info!.events.includes("window.state_changed"));
});

test(".uiform：Metadata・Id・Kind・components の欠け、key の重なり、知らない部品を弾く", () => {
  assert.deepEqual(codes(checkUiForm("a", { Data: { components: [] } })), ["FORM_NO_METADATA"]);
  assert.deepEqual(codes(checkUiForm("a", form([], { Id: "x", Kind: "Html" }))), ["FORM_BAD_ID", "FORM_BAD_KIND"]);
  assert.deepEqual(codes(checkUiForm("a", { Metadata: { Id: ID, Kind: "FormIo" }, Data: [] })), ["FORM_NO_COMPONENTS"]);
  assert.deepEqual(codes(checkUiForm("a", form([{ type: "textfield", key: "a" }, { type: "number", key: "a" }]))), ["FORM_DUP_KEY"]);
  assert.deepEqual(codes(checkUiForm("a", form([{ type: "textfield" }]))), ["FORM_NO_KEY"]);
  assert.deepEqual(codes(checkUiForm("a", form([{ type: "rating", key: "r" }]))), ["FORM_UNKNOWN_TYPE"]);
  assert.deepEqual(codes(checkUiForm("a", form([{ type: "button", key: "b", action: "url" }]))), ["FORM_BUTTON_ACTION"]);
});

test("HTML：先頭の <!-- form --> を読む。無ければフォームではない。uiPathApi が無いと弾く", () => {
  const head = (md: object) => `<!-- form\n${JSON.stringify({ Metadata: md })}\n-->\n<html><body><input id="name"></body></html>`;
  assert.deepEqual(codes(checkHtmlForm("a.html", "<html></html>")), []);
  assert.equal(checkHtmlForm("a.html", "<html></html>").info, undefined);
  const r = checkHtmlForm("a.html", head({ Id: ID, Kind: "Html" }));
  assert.deepEqual(codes(r), ["FORM_HTML_NO_API"]);
  assert.deepEqual(r.info!.keys, ["name"]);
  assert.deepEqual(codes(checkHtmlForm("a.html", head({ Id: ID, Kind: "FormIo" }) + "<script>var uiPathApi={}</script>")), ["FORM_BAD_KIND"]);
});

test("IR：FormId の無いフォーム、無い key、無いイベントを弾く", () => {
  const forms = [{ file: "f.uiform", id: ID, kind: "FormIo" as const, keys: ["name"], events: ["name.changed", "window.closed"] }];
  const wf: Workflow = {
    workflow: "W",
    body: [
      { act: "ShowFormActivity", props: { FormId: "00000000-0000-0000-0000-000000000000" } },
      { act: "SetFormFieldsActivity", props: { FormId: ID }, dicts: { Arguments: [{ name: "nam", dir: "In", type: "String", value: { lit: "x" } }, { name: "name.Items", dir: "In", type: "String[]", value: "a" }] } },
      { act: "TriggerScope", props: {}, slots: { Triggers: [{ act: "FormTriggerActivity", typeArg: "FormInfoTriggerEventArgs", props: { FormId: ID, Event: "name.click" } }], Action: [] } },
      { act: "CloseFormActivity", props: {} },
    ],
  };
  assert.deepEqual(checkWorkflowRefs(wf, "w.json", forms).map((i) => i.code), ["FORM_ID_NOT_FOUND", "FORM_KEY_NOT_FOUND", "FORM_EVENT_NOT_FOUND", "FORM_ID_MISSING"]);
});
