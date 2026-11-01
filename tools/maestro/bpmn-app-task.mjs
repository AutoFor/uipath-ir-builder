// BPMN の Action App の人のタスクを、実行できる形に書き換える（AUT-1079）。
// SDK の humanTask({ app }) は Actions.HITL v1 + appId を作るが、テナントでは 170000 Failure in the AppTasks request で落ちた
// （アプリの ID でもシステム名でも、appVersion や key を足しても）。
// Case の compile が作る BPMN と同じ v2 + name / folderPath の binding にすると、タスクができた（docs/maestro-tenant-resources.md）。
//
// 使い方: node tools/maestro/bpmn-app-task.mjs <ファイル.bpmn> <タスクの id> <アプリの名前> <アプリのフォルダ>
// ファイルを上書きする。テナントには触らない。format の後に流す。そのあと entry-points.json を消して bpmn refresh を流す。

import { readFileSync, writeFileSync } from "node:fs";
import { pathToFileURL } from "node:url";

const xmlAttr = (s) => String(s).replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/'/g, "&#39;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

/** タスクの Actions.HITL を v2 にし、アプリを binding で指す。タスクが無いか、アプリを指していなければ投げる */
export function appTaskToV2(xml, { task, name, folder }) {
  const re = new RegExp(`(<bpmn:userTask\\b[^>]*\\bid="${task}"[^>]*>)([\\s\\S]*?)(</bpmn:userTask>)`);
  const m = xml.match(re);
  if (!m) throw new Error(`userTask ${task} が無い`);
  if (!m[2].includes('name="appId"')) throw new Error(`userTask ${task} に appId が無い（humanTask({ app }) の成果物ではない）`);
  const nameId = `${task}_app_name`;
  const folderId = `${task}_app_folder`;
  const body = m[2]
    .replace('<uipath:type value="Actions.HITL" version="v1" />', '<uipath:type value="Actions.HITL" version="v2" />')
    .replace(/<uipath:input name="appId"[^>]*\/>/, `<uipath:input name="name" type="string" value="=bindings.${nameId}" />\n            <uipath:input name="folderPath" type="string" value="=bindings.${folderId}" />`)
    .replace(/\s*<uipath:input name="(?:appVersion|actions|key)"[^>]*\/>/g, "");
  const resourceKey = xmlAttr(`${folder}.${name}`);
  const bindings = [
    `<uipath:binding id="${nameId}" name="name" type="string" default="${xmlAttr(name)}" resource="app" resourceKey="${resourceKey}" propertyAttribute="name" />`,
    `<uipath:binding id="${folderId}" name="folderPath" type="string" default="${xmlAttr(folder)}" resource="app" resourceKey="${resourceKey}" propertyAttribute="folderPath" />`,
  ].join("\n        ");
  let out = xml.replace(re, () => m[1] + body + m[3]);
  if (out.includes("</uipath:bindings>")) return out.replace("</uipath:bindings>", `  ${bindings}\n      </uipath:bindings>`);
  const block = `<uipath:bindings version="v1">\n        ${bindings}\n      </uipath:bindings>`;
  if (/<bpmn:process\b[^>]*>\s*<bpmn:extensionElements>/.test(out)) return out.replace(/(<bpmn:process\b[^>]*>\s*<bpmn:extensionElements>)/, (s) => `${s}\n      ${block}`);
  return out.replace(/(<bpmn:process\b[^>]*>)/, (s) => `${s}\n    <bpmn:extensionElements>\n      ${block}\n    </bpmn:extensionElements>`);
}

if (process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url) {
  const [file, task, name, folder] = process.argv.slice(2);
  if (!folder) {
    console.error("使い方: node tools/maestro/bpmn-app-task.mjs <ファイル.bpmn> <タスクの id> <アプリの名前> <アプリのフォルダ>");
    process.exit(2);
  }
  writeFileSync(file, appTaskToV2(readFileSync(file, "utf8"), { task, name, folder }), "utf8");
}
