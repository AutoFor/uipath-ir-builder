// テナントの資源（AUT-1079）：名前とフォルダで RPA を呼ぶ。実行はしていない
import { bpmn } from "@uipath/maestro-builder-sdk/bpmn";
export default bpmn("RpaNode").name("RpaNode")
  .startEvent("start")
  .startProcess("hello", { process: "TestHelloWorld", folder: "Common" })
  .endEvent("end")
  .sequenceFlow("start", "hello")
  .sequenceFlow("hello", "end")
  .build();
