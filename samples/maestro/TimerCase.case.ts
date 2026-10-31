// テナントで動いた Case（AUT-1080）：人のタスクの代わりに短いタイマーを1つ待つだけ。アプリの無い action は実行時に 170004 で落ちる
import { casePlan, rule } from "@uipath/maestro-builder-sdk/case";

export default casePlan("timer-case")
  .name("TimerCase")
  .identifier("TMR")
  .stage("Wait", (s) =>
    s
      .entryWhen(rule("case-entered"))
      .task("Short wait", (t) =>
        t
          .waitForTimer({ duration: "PT5S" })
          .entryWhen(rule("current-stage-entered")),
      )
      .exitWhen(rule("selected-tasks-completed", { tasks: ["Short wait"] }), { marksStageComplete: true }),
  )
  .completeWhen(rule("selected-stage-completed", { stage: "Wait" }), { marksCaseComplete: true })
  .build();
