// 割り当て（AUT-1090）：BPMN の QuickForm。SDK の humanTask に recipient が無いので、format の後に tools/maestro/bpmn-assign.mjs で足す
import { bpmn } from "@uipath/maestro-builder-sdk/bpmn";
export default bpmn("AssignForm").name("AssignForm")
  .var("decision", "string")
  .startEvent("start")
  .humanTask("review", { title: "割り当ての確認", form: { fields: [{ id: "comment", label: "コメント", type: "string", direction: "output" }], outcomes: ["Approve", "Reject"] }, outputs: { decision: "=Action" } })
  .endEvent("end")
  .sequenceFlow("start", "review")
  .sequenceFlow("review", "end")
  .build();
