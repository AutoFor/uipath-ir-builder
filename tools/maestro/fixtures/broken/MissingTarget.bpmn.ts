// 線の先が無い
import { bpmn } from "@uipath/maestro-builder-sdk/bpmn";
export default bpmn("missing-target").name("MissingTarget")
  .startEvent("start").endEvent("end")
  .sequenceFlow("start", "nope")
  .build();
