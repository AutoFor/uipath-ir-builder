// テナントの資源（AUT-1079）：BPMN から副作用の無い読み取りのコネクタ（Slack のユーザーグループの一覧）
import { bpmn } from "@uipath/maestro-builder-sdk/bpmn";
export default bpmn("SlackNode").name("SlackNode")
  .startEvent("start")
  .connector("sl", "uipath-salesforce-slack", "list-all-user-groups", {}, { connection: "slack", folder: "shared" })
  .endEvent("end")
  .sequenceFlow("start", "sl")
  .sequenceFlow("sl", "end")
  .build();
