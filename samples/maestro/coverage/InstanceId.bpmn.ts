// Maestro BPMN の見本：Custom instance ID（インスタンスの名前を、入力から式で決める）（AUT-1211）。
// SDK 6.66.5 に専用のオプションは無い。Studio Web で開始イベントの General → Custom instance ID に式を入れて保存した形
// （uip solution download で読んだ）をそのまま書く：
//   - 内部の変数 internalCustomInstanceId（name は _internalCustomInstanceId、elementId は開始イベント、custom と internal）
//   - 開始イベントの uipath:mapping（BPMN.Variables）に、その変数へ写す出力を 1 行
// 開始イベントが終わった直後に 1 回だけ評価される（文書）。式は他の欄と同じく =vars.<名前>。
// 動かす：node tools/maestro/verify.mjs --out <dir> samples/maestro/coverage/InstanceId.bpmn.ts
//        node tools/maestro/debug.mjs <dir>/InstanceId.bpmn/InstanceId.bpmn --profile trial -i '{"orderNo":"A-100"}'

import { bpmn } from "@uipath/maestro-builder-sdk/bpmn";

export default bpmn("InstanceId")
  .name("InstanceId")
  .input("orderNo", "string")
  .var("internalCustomInstanceId", "string", { name: "_internalCustomInstanceId", elementId: "start", custom: true, internal: true })
  .startEvent("start", {
    payload: {
      type: "BPMN.Variables",
      outputRows: [{ name: "_internalCustomInstanceId", type: "string", source: '="注文-" + vars.orderNo', var: "internalCustomInstanceId", custom: true }],
    },
  })
  .scriptTask("echo", { script: "return { id: vars.internalCustomInstanceId };" })
  .endEvent("end")
  .sequenceFlow("start", "echo")
  .sequenceFlow("echo", "end")
  .build();
