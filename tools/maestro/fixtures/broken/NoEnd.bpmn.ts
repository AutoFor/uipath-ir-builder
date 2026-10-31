// 終了イベントが無い
import { bpmn } from "@uipath/maestro-builder-sdk/bpmn";
export default bpmn("no-end").name("NoEnd")
  .startEvent("start").scriptTask("s", { script: "return 1;" })
  .sequenceFlow("start", "s")
  .build();
