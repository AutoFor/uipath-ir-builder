// テナントの資源（AUT-1079）：Case のタスクから読み取りのコネクタ。実行はしていない
import { casePlan, rule } from "@uipath/maestro-builder-sdk/case";
export default casePlan("connector-node").name("ConnectorNode").identifier("CON")
  .stage("Run", (s) => s.entryWhen(rule("case-entered"))
    .task("Mail", (t) => t.connector("uipath-microsoft-outlook365", "get-email-by-id", { id: "dummy" }, { connection: "outlook", folder: "shared" }).entryWhen(rule("current-stage-entered")))
    .exitWhen(rule("selected-tasks-completed", { tasks: ["Mail"] }), { marksStageComplete: true }))
  .completeWhen(rule("selected-stage-completed", { stage: "Run" }), { marksCaseComplete: true })
  .build();
