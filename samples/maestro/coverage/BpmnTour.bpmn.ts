// Maestro BPMN の見本：並列ゲートウェイ（分けて合わせる）、タイマーの中間イベント、サブプロセス、multi-instance、エラーの境界イベント。
// テナントの資源は要らない。
//   node tools/maestro/verify.mjs --out <dir> samples/maestro/coverage/BpmnTour.bpmn.ts
//   node tools/maestro/debug.mjs <dir>/BpmnTour.bpmn/BpmnTour.bpmn

import { bpmn } from "@uipath/maestro-builder-sdk/bpmn";

export default bpmn("BpmnTour")
  .name("BpmnTour")
  .var("items", "array")
  .startEvent("start")
  .scriptTask("init", { script: "return { items: [\"a\", \"b\", \"c\"] };", outputs: { items: "=result.response.items" } })
  // 並列に分けて、合わせる
  .parallelGateway("split")
  .scriptTask("left", { script: "return { side: \"left\" };" })
  .scriptTask("right", { script: "return { side: \"right\" };" })
  .parallelGateway("join")
  // 5 秒待つ
  .intermediateCatchEvent("pause", { timer: { duration: "PT5S" } })
  // サブプロセス（同じインスタンスの中で動く）
  .subProcess("inner", (sp) => sp
    .startEvent("innerStart")
    .scriptTask("innerWork", { script: "return { inner: true };" })
    .endEvent("innerEnd")
    .sequenceFlow("innerStart", "innerWork")
    .sequenceFlow("innerWork", "innerEnd"))
  // 配列の要素ごとに 1 回ずつ（順番に）。今の要素は itemVar を "iterator[0]" にし、inputs で "=iterator[0].item" を渡して、スクリプトでは名前（cur）で読む
  // （テナントで確かめた形。itemVar: "item" と iterator.item / vars.item では値が入らない。knowledge/maestro.md）
  .scriptTask("each", { script: "if (cur == null) throw new Error(\"item が無い\"); return { seen: cur };", inputs: { cur: "=iterator[0].item" }, loop: { collection: "=vars.items", itemVar: "iterator[0]", sequential: true } })
  // わざと落とし、エラーの境界イベントで受ける
  .scriptTask("boom", { script: "throw new Error(\"わざと失敗\");" })
  .boundaryEvent("caught", { attachedTo: "boom", error: true })
  .scriptTask("recover", { script: "return { recovered: true };" })
  .endEvent("done")
  .endEvent("handled")
  .sequenceFlow("start", "init")
  .sequenceFlow("init", "split")
  .sequenceFlow("split", "left")
  .sequenceFlow("split", "right")
  .sequenceFlow("left", "join")
  .sequenceFlow("right", "join")
  .sequenceFlow("join", "pause")
  .sequenceFlow("pause", "inner")
  .sequenceFlow("inner", "each")
  .sequenceFlow("each", "boom")
  .sequenceFlow("boom", "done")
  .sequenceFlow("caught", "recover")
  .sequenceFlow("recover", "handled")
  .build();
