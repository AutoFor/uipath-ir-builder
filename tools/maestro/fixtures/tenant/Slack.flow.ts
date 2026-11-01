// テナントの資源（AUT-1079）：副作用の無い読み取りのコネクタ（Slack のユーザーグループの一覧）。接続は記号名で、実際の ID は bindings.json（コミットしない）
// 先に: uip maestro registry prepare uipath-salesforce-slack --action list-all-user-groups（docs/maestro-tenant-resources.md）
import { flow, connector } from "@uipath/maestro-builder-sdk";
export default flow("slack-node").name("SlackNode")
  .step("sl", connector("uipath-salesforce-slack", "list-all-user-groups", {}, { connection: "slack", folder: "shared" }))
  .build();
