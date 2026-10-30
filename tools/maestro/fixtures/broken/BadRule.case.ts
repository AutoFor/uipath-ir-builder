// 規則が無いタスクを指す
import { casePlan, rule } from "@uipath/maestro-builder-sdk/case";
export default casePlan("bad-rule").name("BadRule").identifier("BAD")
  .stage("Review", (s) => s.entryWhen(rule("case-entered"))
    .task("A", (t) => t.action({ title: "a", priority: "Medium" }).entryWhen(rule("current-stage-entered")))
    .exitWhen(rule("selected-tasks-completed", { tasks: ["Nope"] }), { marksStageComplete: true }))
  .completeWhen(rule("selected-stage-completed", { stage: "Review" }), { marksCaseComplete: true })
  .build();
