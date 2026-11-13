// Maestro Case の見本：3 つのステージを順に進める（受付 → 確認〔タスク 2 つを並べて動かす〕→ 締め）。
// タスクは短いタイマー（人もテナントの資源も要らない）。ステージは前のステージの完了で入り、必要なタスクが終わると完了する。
// ケースは必須のステージが全部終わると完了する。
//   node tools/maestro/verify.mjs --out <dir> samples/maestro/coverage/CaseTour.case.ts

import { casePlan, rule } from "@uipath/maestro-builder-sdk/case";

export default casePlan("case-tour")
  .name("CaseTour")
  .identifier("TOUR")
  .stage("Intake", (s) =>
    s
      .entryWhen(rule("case-entered"))
      .task("Receive", (t) => t.waitForTimer({ duration: "PT3S" }).entryWhen(rule("current-stage-entered")))
      .exitWhen(rule("selected-tasks-completed", { tasks: ["Receive"] }), { marksStageComplete: true }),
  )
  .stage("Review", (s) =>
    s
      .entryWhen(rule("selected-stage-completed", { stage: "Intake" }))
      .task("CheckA", (t) => t.waitForTimer({ duration: "PT3S" }).entryWhen(rule("current-stage-entered")))
      .task("CheckB", (t) => t.waitForTimer({ duration: "PT6S" }).entryWhen(rule("current-stage-entered")))
      .exitWhen(rule("selected-tasks-completed", { tasks: ["CheckA", "CheckB"] }), { marksStageComplete: true }),
  )
  .stage("Close", (s) =>
    s
      .entryWhen(rule("selected-stage-completed", { stage: "Review" }))
      .task("Archive", (t) => t.waitForTimer({ duration: "PT2S" }).entryWhen(rule("current-stage-entered")))
      .exitWhen(rule("selected-tasks-completed", { tasks: ["Archive"] }), { marksStageComplete: true }),
  )
  .completeWhen(rule("selected-stage-completed", { stage: "Close" }), { marksCaseComplete: true })
  .build();
