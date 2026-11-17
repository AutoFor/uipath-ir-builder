// Maestro Automate の見本：Integration Service のコネクタのノード（UiPath GenAI Activities、uipath-uipath-airdk）（AUT-1180）。
// 言語の判定 → 要約 → Web 検索を順に呼び、最後の Script で 3 つの出力を読む。どれも読むだけで、外に書き込まない。
// 接続はソースに記号名（genai・mine）だけを書き、実際の Id は <ws>/.flow-sdk/bindings.json に置く（コミットしない）。
// bindings.json は `uip maestro registry prepare` が作るが、prepare は --profile を見ない（knowledge/maestro.md の 3 章）。
// 別のログインのテナントで動かすときは、bindings.json を手で書く：
//   { "schemaVersion": "1", "bindings": [
//     { "id": "genai", "name": "genai", "resource": "Connection", "resourceKey": "<接続の Id>", "default": "<接続の Id>", "propertyAttribute": "ConnectionId" },
//     { "id": "mine",  "name": "mine",  "resource": "Connection", "resourceKey": "<接続のフォルダの Key>", "default": "<同じ>", "propertyAttribute": "FolderKey" } ] }
//   接続の Id とフォルダの Key は `uip is connections list uipath-uipath-airdk --all-folders --profile <名前>` の Id と FolderKey。
// 動かす：node tools/maestro/verify.mjs --automate --workspace <ws> --out <dir> samples/maestro/deploy/GenAiTour.flow.ts
//        node tools/maestro/debug.mjs <dir>/GenAiTour.flow/GenAiTour.flow --automate --profile trial

import { flow, connector, script, input, types } from "@uipath/maestro-builder-sdk";

const conn = { connection: "genai", folder: "mine" };

export default flow("GenAiTour")
  .name("GenAiTour")
  .input({ text: types.string })
  .step("lang", connector("uipath-uipath-airdk", "detect-language", { text: input("text") }, conn))
  .step("summary", connector("uipath-uipath-airdk", "summarize-text", { prompt: input("text"), summaryFormat: "Paragraph", detectInputLanguage: true }, conn))
  .step("search", connector("uipath-uipath-airdk", "web-search", { provider: "GoogleCustomSearch", query: "UiPath Maestro", num: 3 }, conn))
  .step("read", script({ code: "return { lang: $vars.lang.output.language, summary: $vars.summary.output.summary, count: $vars.search.output.results.length, top: $vars.search.output.results[0].url };" }))
  .build();
