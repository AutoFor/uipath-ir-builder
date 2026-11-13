// デプロイして確かめる見本：Data Fabric のレコード作成で始まる Automate の flow（WEBHOOK 方式なのでデプロイが要る）。
// 先に tools/maestro で registry prepare uipath-uipath-dataservice --action record-created（接続は記号名 df）。
import { flow, onEvent, script } from "@uipath/maestro-builder-sdk";

export default flow("DfEvent")
  .name("DfEvent")
  .trigger(onEvent({
    connector: "uipath-uipath-dataservice", event: "record-created",
    // 見張るエンティティ。コンパイル後の detail.filterExpression は消す（残すと起動しない。knowledge/maestro.md 10 節）
    where: { entityScope: "tenant", tenantEntityName: "WorkCalendar" },
    connection: "df", folder: "shared",
  }))
  .step("seen", script({ code: "return { got: JSON.stringify($vars.start.output).slice(0, 500) };" }))
  .build();
