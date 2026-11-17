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
  assert.equal(forms.length, 3);
  const dir = join(root, "samples", "ir", "UiPath.Form.Activities");
  for (const f of readdirSync(dir).filter((x) => x.endsWith(".json") && !x.endsWith(".verify.json"))) {
    const wf = JSON.parse(readFileSync(join(dir, f), "utf8")) as Workflow;
    assert.deepEqual(checkWorkflowRefs(wf, f, forms), [], f);
  }
});

test(".uiform：部品の key とイベント名を出す（ボタンは click.<key>、値は changed.<key>、入れ子もたどる）", () => {
  const r = checkUiForm("a.uiform", form([
    { type: "textfield", key: "name" },
    { type: "columns", key: "cols", columns: [{ components: [{ type: "number", key: "n" }] }, { components: [{ type: "button", key: "go", action: "event" }] }] },
  ]));
  assert.deepEqual(codes(r), []);
  assert.deepEqual(r.info!.keys, ["name", "n"]);
  assert.ok(r.info!.events.includes("click.go") && r.info!.events.includes("changed.n") && r.info!.events.includes("window.state_changed"));
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

test(".uiform：明細の表（datagrid など）の中の key は外に出さない。Studio に無い fieldset / well は弾く", () => {
  const r = checkUiForm("a", form([{ type: "datagrid", key: "items", components: [{ type: "textfield", key: "item" }] }, { type: "fieldset", key: "f", components: [] }]));
  assert.deepEqual(r.info!.keys, ["items"]);
  assert.deepEqual(codes(r), ["FORM_UNKNOWN_TYPE"]);
});

test(".uiform：見た目の注意（スクショで見つけたもの）は warn で、check を落とさない", () => {
  const f = (components: unknown[], dp: object) => ({ ...form(components), DesignProperties: dp });
  const warns = (j: unknown) => checkUiForm("a", j).issues.filter((i) => i.level === "warn").map((i) => i.code);
  assert.deepEqual(warns(f([{ type: "columns", key: "c", columns: [{ size: "md", components: [] }] }], { Width: 720 })), ["FORM_COLUMNS_STACK"]);
  assert.deepEqual(warns(f([{ type: "columns", key: "c", columns: [{ size: "sm", components: [] }] }], { Width: 720 })), []);
  assert.deepEqual(warns(f([], { Height: 760, Theme: "Dark" })), ["FORM_THEME", "FORM_TOO_TALL"]);
  assert.deepEqual(warns(f([{ type: "currency", key: "a", decimalLimit: 0 }, { type: "phoneNumber", key: "p" }], {})), ["FORM_CURRENCY_DECIMAL", "FORM_PHONE_MASK"]);
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
  const forms = [{ file: "f.uiform", id: ID, kind: "FormIo" as const, keys: ["name"], events: ["changed.name", "click.go", "window.closed"], types: { name: "textfield" } }];
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

test("IR：Event の順が逆（greet.click）なら直し方を出す。文字の部品の changed も通す（AUT-1213 で発火を確かめた）", () => {
  const forms = [{ file: "f.uiform", id: ID, kind: "FormIo" as const, keys: ["name"], events: ["changed.name", "click.go"], types: { name: "textfield" } }];
  const trig = (ev: string): Workflow => ({ workflow: "W", body: [{ act: "FormTriggerActivity", typeArg: "FormInfoTriggerEventArgs", props: { FormId: ID, Event: ev } }] });
  const swapped = checkWorkflowRefs(trig("go.click"), "w", forms);
  assert.deepEqual(swapped.map((i) => i.code), ["FORM_EVENT_NOT_FOUND"]);
  assert.match(swapped[0].message, /"click\.go" と書く/);
  assert.deepEqual(checkWorkflowRefs(trig("changed.name"), "w", forms), []);
  assert.deepEqual(checkWorkflowRefs(trig("click.go"), "w", forms), []);
});
