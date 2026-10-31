// テナントの資源（AUT-1079）：読み取りのコネクタ。接続は記号名で、実際の ID は bindings.json（コミットしない）。実行はしていない
// 先に: uip maestro registry prepare uipath-microsoft-outlook365 --action get-email-by-id（docs/maestro-tenant-resources.md）
import { flow, connector } from "@uipath/maestro-builder-sdk";
export default flow("connector-node").name("ConnectorNode")
  .step("mail", connector("uipath-microsoft-outlook365", "get-email-by-id", { id: "dummy" }, { connection: "outlook", folder: "shared" }))
  .build();
