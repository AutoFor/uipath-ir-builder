// Maestro Flow の見本：コネクタのイベント（Data Fabric のレコード作成）で始める・途中で待つ。手元の検証だけ。
// 先に（tools/maestro で）: uip maestro registry pull、uip maestro registry prepare uipath-uipath-dataservice --action record-created \
//   --connection "<接続名>" --bind-connection df --bindings <ws>/.flow-sdk/bindings.json --out <ws>/.flow-sdk/connectors-local
// このイベントは WEBHOOK 方式で、デバッグでは動かない（デプロイして確かめる。prepare がそう言う）。
import { flow, onEvent, waitForEvent, script } from "@uipath/maestro-builder-sdk";

export default flow("EventWait")
  .name("EventWait")
  .trigger(onEvent({ connector: "uipath-uipath-dataservice", event: "record-created", connection: "df", folder: "shared" }))
  .step("note", script({ code: "return { started: true };" }))
  .step("next", waitForEvent({ connector: "uipath-uipath-dataservice", event: "record-created", connection: "df", folder: "shared" }))
  .build();
