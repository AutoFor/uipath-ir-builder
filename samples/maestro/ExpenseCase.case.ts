// Case Management は工程の並びではなく「ステージ + 開始・終了の条件」なので、プロセス IR からは作らず、公式 SDK のソースを直接書いて試した
import { casePlan, rule } from "@uipath/maestro-builder-sdk/case";

export default casePlan("expense-case")
  .name("ExpenseCase")
  .identifier("EXP")
  .stage("Review", (s) =>
    s
      .entryWhen(rule("case-entered"))
      .task("Approve expense", (t) =>
        t
          .action({ title: "経費の確認", priority: "Medium" })
          .entryWhen(rule("current-stage-entered")),
      )
      .exitWhen(rule("selected-tasks-completed", { tasks: ["Approve expense"] }), { marksStageComplete: true }),
  )
  .completeWhen(rule("selected-stage-completed", { stage: "Review" }), { marksCaseComplete: true })
  .build();
