// テナントの資源（AUT-1079）：Case の人のタスクにテスト用の Coded Action App を指定する
import { casePlan, rule } from "@uipath/maestro-builder-sdk/case";
export default casePlan("app-node").name("AppNode").identifier("APP")
  .stage("Review", (s) => s.entryWhen(rule("case-entered"))
    .task("Approve", (t) => t.action({
      title: "AUT-1079 Case の確認",
      priority: "Low",
      app: { name: "uipath-ir-test-approval", folder: "seiya-kawashima@autofor.co.jp's workspace" },
      inputs: [{ name: "note", value: "Case から" }],
      outputs: [{ name: "comment" }],
    }).entryWhen(rule("current-stage-entered")))
    .exitWhen(rule("selected-tasks-completed", { tasks: ["Approve"] }), { marksStageComplete: true }))
  .completeWhen(rule("selected-stage-completed", { stage: "Review" }), { marksCaseComplete: true })
  .build();
