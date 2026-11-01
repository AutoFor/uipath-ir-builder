import { test } from "node:test";
import assert from "node:assert/strict";
import { appTaskToV2 } from "./bpmn-app-task.mjs";
import { extractRefs } from "./tenant-refs.mjs";

const xml = (ext = "") => `<bpmn:process id="P" isExecutable="true">${ext}
<bpmn:userTask id="review"><bpmn:extensionElements><uipath:activity version="v1">
<uipath:type value="Actions.HITL" version="v1" />
<uipath:context>
<uipath:input name="appId" type="string" value="abc" />
<uipath:input name="appVersion" type="string" value="1" />
<uipath:input name="actions" type="string" value="A,B" />
<uipath:input name="taskTitle" type="string" value="t" />
</uipath:context></uipath:activity></bpmn:extensionElements></bpmn:userTask></bpmn:process>`;
const app = { task: "review", name: "App", folder: "me's workspace" };

test("v2 にして、appId などを binding の name と folderPath に置き換える", () => {
  const out = appTaskToV2(xml(), app);
  assert.match(out, /Actions\.HITL" version="v2"/);
  assert.doesNotMatch(out, /name="(appId|appVersion|actions)"/);
  assert.match(out, /name="taskTitle"/);
  assert.match(out, /name="name" type="string" value="=bindings\.review_app_name"/);
  assert.match(out, /name="folderPath" type="string" value="=bindings\.review_app_folder"/);
  assert.match(out, /default="me&#39;s workspace"/);
});

test("extensionElements や bindings があれば、その中に足す", () => {
  const a = appTaskToV2(xml("<bpmn:extensionElements><uipath:variables /></bpmn:extensionElements>"), app);
  assert.equal(a.match(/<bpmn:extensionElements>/g).length, 2);
  assert.match(a, /<bpmn:extensionElements>\s*<uipath:bindings version="v1">/);
  const b = appTaskToV2(xml('<bpmn:extensionElements><uipath:bindings version="v1"><uipath:binding id="x" /></uipath:bindings></bpmn:extensionElements>'), app);
  assert.equal(b.match(/<uipath:bindings /g).length, 1);
  assert.match(b, /id="x"[\s\S]*review_app_name[\s\S]*<\/uipath:bindings>/);
});

test("--tenant の照合で、BPMN のアプリの名前とフォルダが取れる", () => {
  assert.deepEqual(extractRefs("bpmn", appTaskToV2(xml(), app)), [{ kind: "app", name: "App", folder: "me's workspace", key: undefined }]);
});

test("タスクが無いか、アプリを指していなければ投げる", () => {
  assert.throws(() => appTaskToV2(xml(), { ...app, task: "none" }), /が無い/);
  assert.throws(() => appTaskToV2(xml().replace(/<uipath:input name="appId"[^>]*\/>/, ""), app), /appId/);
});
