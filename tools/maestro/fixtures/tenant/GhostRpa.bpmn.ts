// 穴：テナントに無い RPA
import { bpmn } from "@uipath/maestro-builder-sdk/bpmn";
export default bpmn("GhostRpa").name("GhostRpa")
  .startEvent("start")
  .startProcess("hello", { process: "NoSuchProcess", folder: "NoSuchFolder" })
  .endEvent("end")
  .sequenceFlow("start", "hello")
  .sequenceFlow("hello", "end")
  .build();
