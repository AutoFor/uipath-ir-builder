// Maestro BPMN の見本：Inclusive ゲートウェイ（当たった道を全部通り、通った数だけ待って合わせる）、
// Event-based ゲートウェイ（タイマーとメッセージの早いほう。ここではタイマーが勝つ）、エラー開始のイベントサブプロセス。
// テナントの資源は要らない。

import { bpmn } from "@uipath/maestro-builder-sdk/bpmn";

export default bpmn("BpmnEvents")
  .name("BpmnEvents")
  .input("amount", "number")
  .startEvent("start")
  // amount > 10 と amount > 100 の両方に当たれば 2 本とも通る。Inclusive の default の道は、ほかに当たっても毎回通った（テナントで確かめた）
  .inclusiveGateway("fan", { default: "fan_none" })
  .scriptTask("over10", { script: "return { over10: true };" })
  .scriptTask("over100", { script: "return { over100: true };" })
  .scriptTask("small", { script: "return { small: true };" })
  .inclusiveGateway("merge")
  // 3 秒と 1 時間の早いほう（3 秒が勝つ）。メッセージの中間イベントは、コネクタのイベントを結ばないと待たずにすぐ完了した（テナントで確かめた）ので使わない
  .eventBasedGateway("race")
  .intermediateCatchEvent("timeout", { timer: { duration: "PT3S" } })
  .intermediateCatchEvent("reply", { timer: { duration: "PT1H" } })
  .scriptTask("timedOut", { script: "return { timedOut: true };" })
  .scriptTask("replied", { script: "return { replied: true };" })
  .endEvent("endTimeout")
  .endEvent("endReply")
  // エラー開始のイベントサブプロセス：本線の失敗をここで受けて終える。開始イベントは SDK が <id>_start として作る（自分で書くとエラー）
  .scriptTask("boom", { script: "throw new Error(\"わざと失敗\");" })
  .eventSubProcess("onFailure", { error: true }, (h) => h
    .scriptTask("note", { script: "return { handled: true };" })
    .endEvent("failEnd")
    .sequenceFlow("onFailure_start", "note")
    .sequenceFlow("note", "failEnd"))
  .sequenceFlow("start", "fan")
  .sequenceFlow("fan", "over10", { condition: "=vars.amount > 10" })
  .sequenceFlow("fan", "over100", { condition: "=vars.amount > 100" })
  .sequenceFlow("fan", "small", { id: "fan_none" })
  .sequenceFlow("over10", "merge")
  .sequenceFlow("over100", "merge")
  .sequenceFlow("small", "merge")
  .sequenceFlow("merge", "race")
  .sequenceFlow("race", "timeout")
  .sequenceFlow("race", "reply")
  .sequenceFlow("timeout", "timedOut")
  .sequenceFlow("reply", "replied")
  .sequenceFlow("timedOut", "boom")
  .sequenceFlow("boom", "endTimeout")
  .sequenceFlow("replied", "endReply")
  .build();
