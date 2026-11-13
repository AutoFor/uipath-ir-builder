// Maestro BPMN の見本：入力 → Script task → Exclusive ゲートウェイ（既定の道つき）→ 終了。人のタスクもテナントの資源も無い。
// BPMN の式は vars.<名前>（Flow の $vars とは違う）。Script の戻り値は =result.response（ドキュメントの scriptResponse ではない。間違えても validate は通り、値が入らないだけ）。Exclusive には既定の道（default）を必ず付ける（無いと条件に当たらないとき Faulted）。

import { bpmn } from "@uipath/maestro-builder-sdk/bpmn";

export default bpmn("ScriptGateway")
  .name("ScriptGateway")
  .input("amount", "number")
  .var("level", "string")
  .startEvent("start")
  .scriptTask("grade", { script: "return { level: vars.amount > 100 ? \"high\" : \"low\" };", outputs: { level: "=result.response.level" } })
  .exclusiveGateway("isHigh", { default: "isHigh_else" })
  .scriptTask("highPath", { script: "return { ok: \"high\" };" })
  .scriptTask("lowPath", { script: "return { ok: \"low\" };" })
  .endEvent("end1")
  .endEvent("end2")
  .sequenceFlow("start", "grade")
  .sequenceFlow("grade", "isHigh")
  .sequenceFlow("isHigh", "highPath", { condition: "=vars.level == \"high\"" })
  .sequenceFlow("isHigh", "lowPath", { id: "isHigh_else" })
  .sequenceFlow("highPath", "end1")
  .sequenceFlow("lowPath", "end2")
  .build();
