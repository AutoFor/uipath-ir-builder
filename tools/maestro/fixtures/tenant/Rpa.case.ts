// テナントの資源（AUT-1079）：Case のタスクから RPA を呼ぶ。実行はしていない
import { casePlan, rule } from "@uipath/maestro-builder-sdk/case";
export default casePlan("rpa-node").name("RpaNode").identifier("RPA")
  .stage("Run", (s) => s.entryWhen(rule("case-entered"))
    .task("Hello", (t) => t.rpa("TestHelloWorld", { folder: "Common" }).entryWhen(rule("current-stage-entered")))
    .exitWhen(rule("selected-tasks-completed", { tasks: ["Hello"] }), { marksStageComplete: true }))
  .completeWhen(rule("selected-stage-completed", { stage: "Run" }), { marksCaseComplete: true })
  .build();
