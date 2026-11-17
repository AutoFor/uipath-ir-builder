// Maestro Case の見本：人のタスクを QuickForm（アプリなしのフォーム）で出す（AUT-1211）。
// SDK 6.66.5 の Case には QuickForm を書く手段が無いので、ここではステージと変数だけを書き、
// compile の後で tools/maestro/case-quickform.mjs がタスク（type "action"、hitlType "quick"）と <タスク>.hitl.json を足す。
// タスクの定義は横の CaseQuickForm.quickform.json。ステージの出口は required-tasks-completed にする（タスクは compile の後に入るので、名前で指せない）。
// verify.mjs は、ソースの横に <名前>.quickform.json があれば compile の後で case-quickform.mjs を当ててから validate する。
// 動かす：node tools/maestro/verify.mjs --out <dir> samples/maestro/coverage/CaseQuickForm.case.ts
//        node tools/maestro/debug.mjs <dir>/CaseQuickForm.case/caseplan.json --profile trial -i '{"amount":12000}'
//        （待っている間に uip tasks list → uip tasks complete <Id> --type QuickFormTask --folder-id <FolderId> --action Approve --data '{"comment":"OK"}'）

import { casePlan, rule, manualTrigger } from "@uipath/maestro-builder-sdk/case";

const start = manualTrigger();

export default casePlan("case-quickform")
  .name("CaseQuickForm")
  .identifier("QF")
  .trigger(start)
  .input({ amount: "number" }, { from: start })
  .var("decision", "string")
  .var("comment", "string")
  .stage("Review", (s) =>
    s
      .entryWhen(rule("case-entered"))
      .exitWhen(rule("required-tasks-completed"), { marksStageComplete: true }),
  )
  .completeWhen(rule("selected-stage-completed", { stage: "Review" }), { marksCaseComplete: true })
  .build();
