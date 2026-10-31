// Case の action に架空の Action App を指定する
import { casePlan, rule } from "@uipath/maestro-builder-sdk/case";
export default casePlan("ghost-app").name("GhostAppCase").identifier("APP")
  .stage("Review", (s) => s.entryWhen(rule("case-entered"))
    .task("Approve", (t) => t.action({ title: "確認", priority: "Medium", app: { name: "NoSuchApp", folder: "NoSuchFolder" } }).entryWhen(rule("current-stage-entered")))
    .exitWhen(rule("selected-tasks-completed", { tasks: ["Approve"] }), { marksStageComplete: true }))
  .completeWhen(rule("selected-stage-completed", { stage: "Review" }), { marksCaseComplete: true })
  .build();
