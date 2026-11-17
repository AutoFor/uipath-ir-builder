// tools/apps/coded-action.ts（Coded Action App の生成器）のテスト。
// npm install と build は、samples/apps/expense-review.json で手で確かめた（knowledge/apps.md）。ここでは書いたものの中身を見る。

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { actionSchema, check, formTsx, generateFiles, scopes, type ActionApp } from "./coded-action.ts";

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
  // 書ける array は要素が文字・数・真偽だけ、書ける object は中が文字・数・真偽だけ（file は上げられる）
  assert.deepEqual(codes(base([{ name: "a", dir: "out", type: "file" }])), []);
  assert.deepEqual(codes(base([{ name: "a", dir: "out", type: "array", items: { type: "object", properties: { x: { type: "string" } } } }])), ["APP_UNSUPPORTED"]);
  assert.deepEqual(codes(base([{ name: "a", dir: "out", type: "array", items: { type: "object", properties: { x: { type: "string" } } }, hidden: true }])), []);
  assert.deepEqual(codes(base([{ name: "a", dir: "inout", type: "object", properties: { x: { type: "file" } } }])), ["APP_UNSUPPORTED"]);
  assert.deepEqual(codes(base([{ name: "a", dir: "in", type: "object", properties: { x: { type: "file" } } }])), []);
  assert.deepEqual(codes(base([{ name: "a", dir: "out", type: "object", properties: { "my-x": { type: "string" } } }])), ["APP_NAME"]);
  assert.deepEqual(codes(base([{ name: "a", dir: "in", type: "string", show: "image" }])), ["APP_CONTROL"]);
  assert.deepEqual(codes(base([], [])), ["APP_SHAPE"]);
  assert.deepEqual(codes(base([], [{ name: "A" }, { name: "A" }])), ["APP_NAME"]);
  // outcome とフィールドも同じ名前にできない（outcomes を含めた 4 つで 1 回）
  assert.deepEqual(codes(base([{ name: "Approve", dir: "out", type: "boolean" }], [{ name: "Approve" }])), ["APP_NAME"]);
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
  assert.match(t, /completeTask\('Approve', toTaskData\(formData, given\.current\)\)/);
  // 書かなかった欄（タスクに無く、値が空）は送らない（AUT-1212）
  assert.match(t, /const toTaskData = \(data: FormData, given: Set<string>\)/);
  assert.match(t, /given\.current = new Set\(Object\.keys\(task\.data \?\? \{\}\)\);/);
  assert.ok(!/setTaskData\(updated\)/.test(t));
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
  assert.ok(t.includes("completeTask('it\\'s', toTaskData(formData, given.current))"));
  assert.ok(t.includes("x {'&'} y"));
});

test("書くファイル：決まった骨組みと、テンプレートの CSS はそのまま", () => {
  const f = generateFiles(sample);
  assert.deepEqual(Object.keys(f).sort(), [".gitignore", "action-schema.json", "index.html", "src/App.css", "src/App.tsx", "src/components/Form.css", "src/components/Form.tsx", "src/components/Parts.css", "src/index.css", "src/main.tsx", "src/uipath.ts", "tsconfig.json", "vite.config.ts"]);
  assert.match(f["vite.config.ts"], /base: '\.\/'/);
  assert.ok(!/^[^/\n]*initialize\(/m.test(f["src/uipath.ts"])); // 注釈の中だけ
  assert.equal(f["src/components/Form.css"], readFileSync(join(root, "templates", "coded-action-app", "Form.css"), "utf8"));
});

test("完了に失敗したらメッセージを出す", () => {
  const t = formTsx(base([], [{ name: "Approve" }]));
  assert.match(t, /showMessage\(.*MessageSeverity\.Error\)/);
  assert.match(t, /import \{ MessageSeverity, Theme \}/);
});

// ---- 書ける array / object / file と SDK（samples/apps/expense-attach.json） ----

const attach: ActionApp = JSON.parse(readFileSync(join(root, "samples", "apps", "expense-attach.json"), "utf8"));

test("見本（添付と SDK）は検証を通る", () => {
  assert.deepEqual(check(attach), []);
});

test("書ける array：要素ごとの部品と、行を足す・消すボタン", () => {
  const t = formTsx(attach);
  assert.match(t, /<div id="items" className="list-editor">/);
  assert.match(t, /setField\('items', formData\.items\.map\(\(y, j\) => \(j === i \? e\.target\.value : y\)\)\)/);
  assert.match(t, /setField\('items', formData\.items\.filter\(\(_, j\) => j !== i\)\)/);
  assert.match(t, /setField\('items', \[\.\.\.formData\.items, ''\]\)/);
  assert.match(t, /type="number" step="any" aria-label=\{'明細ごとの金額' \+ ' ' \+ \(i \+ 1\)\}/);
  assert.match(t, /setField\('amounts', \[\.\.\.formData\.amounts, 0\]\)/);
  // 必須の array は 1 行は要る
  assert.match(t, /formData\.items\.length > 0/);
});

test("書ける object：中のフィールドごとの部品。必須の中身は既定値と判定に入る", () => {
  const t = formTsx(attach);
  assert.match(t, /payee: \{ name: string; bank\?: string; payOn\?: string; count\?: number; urgent\?: boolean \};/);
  assert.match(t, /payee: \{ name: '' \},/);
  assert.match(t, /<input type="date" value=\{formData\.payee\.payOn \?\? ''\} onChange=\{\(e\) => setField\('payee', \{ \.\.\.formData\.payee, payOn: e\.target\.value \}\)\}/);
  assert.match(t, /setField\('payee', \{ \.\.\.formData\.payee, count: Math\.trunc\(Number\(e\.target\.value\)\) \|\| 0 \}\)/);
  assert.match(t, /checked=\{formData\.payee\.urgent \?\? false\} onChange=\{\(e\) => setField\('payee', \{ \.\.\.formData\.payee, urgent: e\.target\.checked \}\)\}/);
  assert.match(t, /\(formData\.payee\.name \?\? ''\)\.trim\(\) !== ''/);
});

test("file：書けるものは Attachments.create で上げて { ID } にする。show は SDK で開く", () => {
  const t = formTsx(attach);
  assert.match(t, /type FileKey = 'fixedReceipt' \| 'signedSheet';/);
  assert.match(t, /const created = await attachments\.create\(file\.name, file\);\n {6}setField\(name, \{ ID: created\.id \}\);/);
  assert.match(t, /<input id="fixedReceipt" type="file" onChange=\{\(e\) => uploadFile\('fixedReceipt', e\)\}/);
  assert.match(t, /<Attachment id=\{formData\.receipt\?\.ID \?\? ''\} mode="image" \/>/);
  assert.match(t, /\{formData\.signedSheet\?\.ID \? <Attachment id=\{formData\.signedSheet\?\.ID \?\? ''\} mode="download" \/> : null\}/);
  assert.match(t, /!!formData\.signedSheet\?\.ID/);
  assert.match(t, /import \{ codedActionAppService, attachments, entities \} from '\.\.\/uipath';/);
});

test("records：Data Fabric のレコードの表を出す", () => {
  const t = formTsx(attach);
  assert.match(t, /<RecordList\n\s+entities=\{entities\}\n\s+title="稼働日カレンダー"\n\s+entity="WorkCalendar"\n\s+columns=\{\[\{ field: 'WorkDate', label: '日付' \}/);
  assert.match(t, /pageSize=\{10\}/);
  assert.deepEqual(codes({ ...base([]), records: [{ title: "x", entity: "A", entityId: "00000000-0000-0000-0000-000000000000", columns: [{ field: "a" }] }] }), ["APP_RECORDS"]);
  assert.deepEqual(codes({ ...base([]), records: [{ title: "x", entityId: "bad", columns: [] }] }), ["APP_RECORDS", "APP_RECORDS"]);
});

test("SDK を使うときだけ uipath.json・SDK の uipath.ts・部品を書く。sdk.initialize() は呼ばない", () => {
  const f = generateFiles(attach);
  assert.deepEqual(JSON.parse(f["uipath.json"]), { scope: "OR.Folders DataFabric.Schema.Read DataFabric.Data.Read", clientId: "<External Application の client ID>" });
  assert.match(f["src/uipath.ts"], /const sdk = new UiPath\(\);/);
  assert.match(f["src/uipath.ts"], /export const attachments = new Attachments\(sdk\);/);
  assert.ok(!/^[^/\n]*initialize\(/m.test(f["src/uipath.ts"]));
  assert.ok(f["src/components/Attachment.tsx"].includes("attachments.getById(id)"));
  assert.ok(f["src/components/RecordList.tsx"].includes("entities.getRecordsByName"));
  // SDK を使わない見本には無い
  const g = generateFiles(sample);
  assert.ok(!("uipath.json" in g) && !("src/components/Attachment.tsx" in g));
  assert.ok(!g["src/uipath.ts"].includes("uipath-typescript"));
  // 開くだけなら読む権限だけ
  assert.equal(scopes(base([{ name: "r", dir: "in", type: "file", show: "download" }])), "OR.Folders.Read");
  assert.equal(scopes({ ...base([]), clientId: "abc" }), "");
});
