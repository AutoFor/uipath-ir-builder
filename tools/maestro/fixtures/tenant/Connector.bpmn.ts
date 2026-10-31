// テナントの資源（AUT-1079）：BPMN から読み取りのコネクタ。実行はしていない
import { bpmn } from "@uipath/maestro-builder-sdk/bpmn";
export default bpmn("ConnectorNode").name("ConnectorNode")
  .startEvent("start")
  .connector("mail", "uipath-microsoft-outlook365", "get-email-by-id", { id: "dummy" }, { connection: "outlook", folder: "shared" })
  .endEvent("end")
  .sequenceFlow("start", "mail")
  .sequenceFlow("mail", "end")
  .build();
