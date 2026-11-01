// テナントの資源（AUT-1079）：BPMN からテスト用の Coded Action App を開く人のタスク。
// この成果物（v1 + appId）はそのままだと 170000 で落ちる。compile と format の後に tools/maestro/bpmn-app-task.mjs で書き換える
import { bpmn } from "@uipath/maestro-builder-sdk/bpmn";
export default bpmn("AppNode").name("AppNode")
  .startEvent("start")
  .humanTask("review", { app: "ddab4478-d11a-4014-b717-2bc489edfade", title: "AUT-1079 BPMN の確認", input: { note: "BPMN から" }, outputs: { decision: "=Action" } })
  .endEvent("end")
  .sequenceFlow("start", "review")
  .sequenceFlow("review", "end")
  .build();
