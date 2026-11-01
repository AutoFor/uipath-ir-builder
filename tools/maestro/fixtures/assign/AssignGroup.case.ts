// 割り当て（AUT-1090）：Case の人のタスクをグループに割り当てる
import { casePlan, rule } from "@uipath/maestro-builder-sdk/case";
export default casePlan("assign-group").name("AssignGroup").identifier("ASG")
  .stage("Review", (s) => s.entryWhen(rule("case-entered"))
    .task("Approve", (t) => t.action({
      title: "割り当ての確認",
      priority: "Low",
      recipient: { type: 1, value: "Reviewers" },
      app: { name: "uipath-ir-test-approval", folder: "Shared" },
      inputs: [{ name: "note", value: "Case から" }],
      outputs: [{ name: "comment" }],
    }).entryWhen(rule("current-stage-entered")))
    .exitWhen(rule("selected-tasks-completed", { tasks: ["Approve"] }), { marksStageComplete: true }))
  .completeWhen(rule("selected-stage-completed", { stage: "Review" }), { marksCaseComplete: true })
  .build();
