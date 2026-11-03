// テナントの資源（AUT-1079）：BPMN からテスト用エージェントを呼ぶ
import { bpmn } from "@uipath/maestro-builder-sdk/bpmn";
export default bpmn("AgentNode").name("AgentNode")
  .startEvent("start")
  .startAgent("ask", { process: "uipath-ir-test-agent", folder: "PERSONAL_WORKSPACE/uipath-ir-test-agent", input: { input: "ok" } })
  .endEvent("end")
  .sequenceFlow("start", "ask")
  .sequenceFlow("ask", "end")
  .build();
