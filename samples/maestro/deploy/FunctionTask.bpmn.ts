// Maestro BPMN の見本：デプロイした JS/TS の関数を Service task「Start and wait for Function」（Orchestrator.ExecuteFunctionAsync）で呼ぶ（AUT-1211）。
// SDK 6.66.5 の BPMN には関数を呼ぶ専用のメソッドが無いので、汎用の .activity() に登録簿の型名を渡す。
// 名前（name）とフォルダ（folderPath）で指すときは typeVersion "v2"（実行時に名前で探す。v1 は releaseKey と folderKey を読む）。
// 関数は FunctionCall.flow.ts と同じ試しの「AUT1211Quote」（Shared）。
// 動かす：node tools/maestro/verify.mjs --out <dir> samples/maestro/deploy/FunctionTask.bpmn.ts
//        node tools/maestro/debug.mjs <dir>/FunctionTask.bpmn/FunctionTask.bpmn --profile trial

import { bpmn } from "@uipath/maestro-builder-sdk/bpmn";

export default bpmn("FunctionTask")
  .name("FunctionTask")
  .var("total", "number")
  .startEvent("start")
  .activity("quote", "Orchestrator.ExecuteFunctionAsync", {
    name: "AUT1211Quote",
    typeVersion: "v2",
    context: { name: "AUT1211Quote", folderPath: "Shared" },
    inputs: { items: [{ price: 1000, quantity: 3 }, { price: 500, quantity: 2 }], tier: "SILVER" },
    outputs: { total: "=total" },
  })
  .scriptTask("check", { script: "if (vars.total !== 3800) throw new Error(\"TOTAL=\" + JSON.stringify(vars.total)); return { ok: true };" })
  .endEvent("end")
  .sequenceFlow("start", "quote")
  .sequenceFlow("quote", "check")
  .sequenceFlow("check", "end")
  .build();
