// tools/apps/rpa-app.ts（ローコードの RPA アプリの生成器）のテスト。
// Studio Web への取り込みは samples/apps/rpa-app-request.json で手で確かめた（knowledge/apps.md）。ここでは書いたものの中身を見る。

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { inflateRawSync } from "node:zlib";
import { check, generateFiles, notices, zip, type RpaApp } from "./rpa-app.ts";

const root = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const sample: RpaApp = JSON.parse(readFileSync(join(root, "samples", "apps", "rpa-app-request.json"), "utf8"));
const codes = (a: RpaApp) => check(a).map((i) => i.code).sort();
const one = (controls: RpaApp["pages"][0]["controls"], extra: Partial<RpaApp> = {}): RpaApp => ({ app: "T", pages: [{ name: "P", controls }, { name: "Q", controls: [] }], ...extra });
const pageOf = (f: Record<string, string>, title: string) => Object.entries(f).filter(([k]) => /\/models\/models-/.test(k)).map(([, v]) => JSON.parse(v)).find((m) => m.type === "form" && m.title === title);
const exprOf = (page: any, control: string, prop: string) => {
  const c: any = Object.values(page.controls).find((x: any) => x.name === control);
  return page.expressions[c.id].expressions[c.properties[prop].value.expressionId];
};

test("見本は検証を通り、開く先のページの注意が出る", () => {
  assert.deepEqual(check(sample), []);
  assert.equal(notices(sample).length, 1);
  assert.match(notices(sample)[0], /APP_OPEN_PAGE .*Confirm/);
});

test("検証：名前、部品、項目、参照", () => {
  assert.deepEqual(codes(one([{ type: "button", name: "Next" }])), ["APP_NAME"]);
  assert.deepEqual(codes(one([{ type: "slider" as "label", name: "A" }])), ["APP_TYPE"]);
  assert.deepEqual(codes(one([{ type: "button", name: "A", placeholder: "x" }])), ["APP_PROP"]);
  assert.deepEqual(codes(one([{ type: "label", name: "A", props: { nope: "x" } }])), ["APP_PROP"]);
  assert.deepEqual(codes(one([{ type: "label", name: "A", text: { var: "X" } }])), ["APP_REF"]);
  assert.deepEqual(codes(one([{ type: "label", name: "A", onClick: [{ open: "Q" }] }])), ["APP_PROP"]);
  assert.deepEqual(codes(one([{ type: "button", name: "A", onClick: [{ open: "P" }] }])), ["APP_REF"]);
  assert.deepEqual(codes(one([{ type: "button", name: "A", onClick: [{ set: "V", value: "Controls.P.Nope.Value" }] }], { variables: [{ name: "V", type: "string" }] })), ["APP_REF"]);
  assert.deepEqual(codes(one([], { variables: [{ name: "V", type: "int32" as "string" }] })), ["APP_UNSUPPORTED"]);
  assert.deepEqual(codes(one([{ type: "label", name: "A" }, { type: "label", name: "A" }])), ["APP_NAME"]);
});

test("ページ：雛形を写して id を振り直し、式だけを書き換える", () => {
  const f = generateFiles(sample);
  const main = pageOf(f, "MainPage");
  const rootPanel = main.controls[main.rootPanelId];
  assert.deepEqual(rootPanel.config.childIds.map((id: string) => main.controls[id].name), ["Title", "Applicant", "Amount", "AppliedOn", "Category", "Memo", "Agree", "GoConfirm"]);
  assert.equal(exprOf(main, "Title", "text").expression, '"経費の申請"');
  assert.equal(exprOf(main, "Applicant", "required").expression, "true");
  assert.equal(exprOf(main, "Amount", "inputControlMinValue").expression, "1");
  assert.match(exprOf(main, "Applicant", "label").contextSourceId, /^\$\.controls\.id[0-9a-f]{32}\.properties\.label\.value$/);
  // 内部の id（"id": "ID1234"）がページの中で重ならない
  const ids: string[] = [];
  JSON.stringify(main, (k, v) => { if (k === "id" && typeof v === "string" && /^ID\d+$/.test(v)) ids.push(v); return v; });
  assert.equal(new Set(ids).size, ids.length);
  assert.ok(Number(main.idCounter) > Math.max(...ids.map((i) => Number(i.slice(2)))));
});

test("App の変数：appFields、式の tokens、bindingReferences", () => {
  const f = generateFiles(sample);
  const app = Object.entries(f).filter(([k]) => /\/models\/models-/.test(k)).map(([, v]) => JSON.parse(v)).find((m) => m.type === "app");
  assert.equal(app.appFields[0].name, "ApplicantName");
  assert.equal(app.appFields[0].appVariableDefinition.dataType, "System.String");
  const confirm = pageOf(f, "Confirm");
  const e = exprOf(confirm, "Who", "text");
  assert.equal(e.expression, "ApplicantName");
  assert.equal(e.tokens[0].tokenId, app.appFields[0].id);
  const eid = (Object.values(confirm.controls).find((x: any) => x.name === "Who") as any).properties.text.value.expressionId;
  assert.deepEqual(confirm.bindingReferences[app.appFields[0].id], [eid]);
  assert.equal(app.defaultForm.rootSystemName, pageOf(f, "MainPage").systemName);
});

test("イベント：XAML、部品の executors、codebehind（.local/ProjectSettings.json）", () => {
  const f = generateFiles(sample);
  const main = pageOf(f, "MainPage"), confirm = pageOf(f, "Confirm");
  const x = f["RequestApp/MainPage_GoConfirm_click.xaml"];
  assert.match(x, /<OutArgument x:TypeArguments="x:String">\[AppVariable\.ApplicantName\]<\/OutArgument>/);
  assert.match(x, /\[Controls\.MainPage\.Applicant\.Value\]/);
  assert.ok(x.includes(`CurrentFormId="${main.formId}"`) && x.includes(`PageFormId="${confirm.formId}"`) && x.includes('PageName="Confirm"'));
  assert.ok(!/<AssemblyReference>Apps\.(app|form)\./.test(x)); // Studio Web が作り直して足す
  const btn: any = Object.values(main.controls).find((c: any) => c.name === "GoConfirm");
  const ex = btn.events.click.executors[0];
  assert.equal(ex.config.workflowPath, "MainPage_GoConfirm_click.xaml");
  assert.equal(main.workflowBindings[ex.config.automationId].controlId, btn.id);
  const meta = JSON.parse(JSON.parse(f["RequestApp/.local/ProjectSettings.json"]).ProjectAppMetadata);
  assert.deepEqual(meta, { "MainPage_GoConfirm_click.xaml": { AppFormId: main.formId, IsAppQueryBuilder: null } });
});

test("ソリューション：uipx、SolutionStorage、resources、DLL は入れない", () => {
  const f = generateFiles(sample);
  const uipx = JSON.parse(f["RequestAppSolution.uipx"]);
  assert.deepEqual(uipx.Projects.map((p: any) => [p.Type, p.ProjectRelativePath]), [["WebApp", "RequestApp/project.uiproj"]]);
  assert.equal(JSON.parse(f["SolutionStorage.json"]).SolutionId, uipx.SolutionId);
  assert.equal(JSON.parse(f["RequestApp/project.json"]).name, "RequestApp");
  assert.ok(f["resources/solution_folder/process/webApp/RequestApp.json"].includes('"packageName": "RequestAppSolution.webApp.RequestApp"'));
  assert.ok(!Object.keys(f).some((k) => /\.entities|JitCustomTypes/.test(k)));
  assert.ok(!Object.values(f).some((s) => /seiya|autofor/i.test(s)));
});

test(".uis：/ 区切りの zip で、.local も入り、中身が戻る", () => {
  const f = generateFiles(sample);
  const z = zip(f);
  const got: Record<string, string> = {};
  for (let o = 0; z.readUInt32LE(o) === 0x04034b50;) {
    const size = z.readUInt32LE(o + 18), n = z.readUInt16LE(o + 26);
    const name = z.toString("utf8", o + 30, o + 30 + n);
    got[name] = inflateRawSync(z.subarray(o + 30 + n, o + 30 + n + size)).toString("utf8");
    o += 30 + n + size;
  }
  assert.deepEqual(got, f);
  assert.ok("RequestApp/.local/ProjectSettings.json" in got);
});
