// テナントの資源（AUT-1079）：Case のタスクから副作用の無い読み取りのコネクタ（Slack のユーザーグループの一覧）
import { casePlan, rule } from "@uipath/maestro-builder-sdk/case";
export default casePlan("slack-node").name("SlackNode").identifier("SLK")
  .stage("Run", (s) => s.entryWhen(rule("case-entered"))
    .task("Sl", (t) => t.connector("uipath-salesforce-slack", "list-all-user-groups", {}, { connection: "slack", folder: "shared" }).entryWhen(rule("current-stage-entered")))
    .exitWhen(rule("selected-tasks-completed", { tasks: ["Sl"] }), { marksStageComplete: true }))
  .completeWhen(rule("selected-stage-completed", { stage: "Run" }), { marksCaseComplete: true })
  .build();
