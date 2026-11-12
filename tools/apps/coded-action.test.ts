// tools/apps/coded-action.ts（Coded Action App の生成器）のテスト。
// npm install と build は、samples/apps/expense-review.json で手で確かめた（knowledge/apps.md）。ここでは書いたものの中身を見る。

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { actionSchema, check, formTsx, generateFiles, type ActionApp } from "./coded-action.ts";

const root = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const sample: ActionApp = JSON.parse(readFileSync(join(root, "samples", "apps", "expense-review.json"), "utf8"));
const codes = (a: ActionApp) => check(a).map((i) => i.code).sort();
const base = (fields: ActionApp["fields"], outcomes: ActionApp["outcomes"] = [{ name: "Done" }]): ActionApp => ({ app: "t", title: "T", fields, outcomes });

test("見本は検証を通る", () => {
  assert.deepEqual(check(sample), []);
});

test("action-schema.json：4 つの節がいつもあり、dir ごとに分かれ、label などの画面の項目は入らない", () => {
  const s = actionSchema(sample);
  assert.deepEqual(Object.keys(s), ["inputs", "outputs", "inOuts", "outcomes"]);
  assert.deepEqual(Object.keys(s.inputs.properties), ["applicant", "amount", "appliedOn", "items", "detail", "receipt", "requestId"]);
  assert.deepEqual(Object.keys(s.inOuts.properties), ["category", "taxIncluded"]);
  assert.deepEqual(s.outcomes.properties, { Reject: { type: "string" }, Approve: { type: "string" } });
  assert.deepEqual(s.inputs.properties.amount, { type: "number", required: true });
  assert.deepEqual(s.outputs.properties.comment, { type: "string", required: true, description: "差し戻すときは直してほしいところを書く" });
  assert.deepEqual(s.inputs.properties.detail, { type: "object", properties: { dept: { type: "string" }, project: { type: "string" } } });
  assert.deepEqual(actionSchema(base([], [{ name: "OK" }])).inOuts, { type: "object", properties: {} });
});

test("検証：uip codedapp と同じスキーマの規則", () => {
  assert.deepEqual(codes(base([{ name: "a", dir: "in", type: "date" as "string" }])), ["APP_TYPE"]);
  assert.deepEqual(codes(base([{ name: "a", dir: "in", type: "number", format: "date" }])), ["APP_FORMAT"]);
  assert.deepEqual(codes(base([{ name: "a", dir: "in", type: "array" }])), ["APP_SHAPE"]);
  assert.deepEqual(codes(base([{ name: "a", dir: "in", type: "array", items: { type: "array", items: { type: "string" } } }])), ["APP_SHAPE"]);
  assert.deepEqual(codes(base([{ name: "a", dir: "in", type: "object" }])), ["APP_SHAPE"]);
});

test("検証：名前、部品、書けない型", () => {
  assert.deepEqual(codes({ ...base([]), app: "Bad Name" }), ["APP_NAME"]);
  assert.deepEqual(codes(base([{ name: "a", dir: "in", type: "string" }, { name: "a", dir: "out", type: "string" }])), ["APP_NAME"]);
  assert.deepEqual(codes(base([{ name: "class", dir: "in", type: "string" }])), ["APP_NAME"]);
  assert.deepEqual(codes(base([{ name: "a", dir: "out", type: "string", control: "select" }])), ["APP_CONTROL"]);
  assert.deepEqual(codes(base([{ name: "a", dir: "out", type: "number", control: "textarea" }])), ["APP_CONTROL"]);
  assert.deepEqual(codes(base([{ name: "a", dir: "out", type: "file" }])), ["APP_UNSUPPORTED"]);
  assert.deepEqual(codes(base([{ name: "a", dir: "out", type: "file", hidden: true }])), []);
  assert.deepEqual(codes(base([], [])), ["APP_SHAPE"]);
  assert.deepEqual(codes(base([], [{ name: "A" }, { name: "A" }])), ["APP_NAME"]);
  assert.deepEqual(codes({ ...base([]), kind: "web" as "action" }), ["APP_KIND"]);
});

test("Form.tsx：型ごとの部品、読むだけ、隠す、必須、結果のボタン", () => {
  const t = formTsx(sample);
  // FormData には全部（隠したものも）
  assert.match(t, /requestId: string;/);
  assert.match(t, /receipt: \{ ID: string \};/);
  assert.match(t, /items: string\[\];/);
  assert.match(t, /detail: \{ dept\?: string; project\?: string \};/);
  // 隠したものは画面に出ない
  assert.ok(!t.includes('htmlFor="requestId"'));
  // 部品
  assert.match(t, /<input id="applicant" name="applicant" value=\{formData\.applicant\} readOnly \/>/);
  assert.match(t, /formatCurrency\(formData\.amount, 'JPY'\)/);
  assert.match(t, /<select id="category" name="category"/);
  assert.match(t, /type="checkbox" className="form-check" checked=\{formData\.taxIncluded\}/);
  assert.match(t, /type="number" min=\{1\} max=\{5\} step=\{1\} value=\{formData\.priority\} onChange=\{handleIntegerChange\}/);
  assert.match(t, /type="radio" name="risk" value="低"/);
  assert.match(t, /<input id="payOn" name="payOn" type="date"/);
  assert.match(t, /<textarea id="comment" name="comment" rows=\{4\} placeholder="判断の理由を書く"/);
  assert.match(t, /<ul id="items" className="value-list">/);
  // 必須（書けるものだけ。入力の applicant は入らない）
  assert.match(t, /!isReadOnly &&\n    formData\.category\.trim\(\) !== '' &&\n    Number\.isFinite\(formData\.approvedAmount\) &&\n    formData\.comment\.trim\(\) !== '';/);
  // 結果：validate: false は必須が空でも押せる。primary は 1 つ
  assert.match(t, /completeTask\('Approve', formData\)/);
  assert.match(t, /outcome-btn--secondary"\n {10}onClick=\{handleReject\}\n {10}disabled=\{isReadOnly\}/);
  assert.match(t, /outcome-btn--primary"\n {10}onClick=\{handleApprove\}\n {10}disabled=\{!isFormValid\}/);
});

test("使わないハンドラは書かない（noUnusedLocals で build が落ちないように）", () => {
  const t = formTsx(base([{ name: "a", dir: "in", type: "string" }], [{ name: "OK" }]));
  assert.ok(!t.includes("handleTextChange") && !t.includes("ChangeEvent") && !t.includes("formatCurrency"));
  assert.match(t, /const isFormValid =\n    !isReadOnly;/);
  const u = formTsx(base([{ name: "n", dir: "out", type: "number" }], [{ name: "OK" }]));
  assert.ok(u.includes("handleNumberChange") && !u.includes("handleTextChange"));
});

test("文字は JSX と JS の文字列として崩れない", () => {
  const t = formTsx({ ...base([{ name: "a", dir: "in", type: "string", label: "a{b}<c>" }], [{ name: "it's" }]), title: "x & y" });
  assert.ok(t.includes("a{'{'}b{'}'}{'<'}c{'>'}"));
  assert.ok(t.includes("completeTask('it\\'s', formData)"));
  assert.ok(t.includes("x {'&'} y"));
});

test("書くファイル：決まった骨組みと、テンプレートの CSS はそのまま", () => {
  const f = generateFiles(sample);
  assert.deepEqual(Object.keys(f).sort(), [".gitignore", "action-schema.json", "index.html", "src/App.css", "src/App.tsx", "src/components/Form.css", "src/components/Form.tsx", "src/components/Parts.css", "src/index.css", "src/main.tsx", "src/uipath.ts", "tsconfig.json", "vite.config.ts"]);
  assert.match(f["vite.config.ts"], /base: '\.\/'/);
  assert.ok(!/^[^/\n]*initialize\(/m.test(f["src/uipath.ts"])); // 注釈の中だけ
  assert.equal(f["src/components/Form.css"], readFileSync(join(root, "templates", "coded-action-app", "Form.css"), "utf8"));
});
