// Maestro Case の見本：Maestro API（CaseApp v3）で、動いているケースを外から操作する（AUT-1211）。
// ステージ Work に、長いタイマーのタスク Wait（ケースを止めずに待たせる）と、ad-hoc のタスク Extra（entryWhen(rule("adhoc"))）を置く。
// ad-hoc のタスクは allowAdhocTasks() で外から起こせる。動かしている間に API で読む・起こす・閉じる（knowledge/maestro.md の 7 章）：
//   node tools/platform/cloud-api.mjs GET  /v3/caseapp/instances/<id>/tasks/adhoc --service pims_ --folder-key <FolderKey> --profile trial
//   node tools/platform/cloud-api.mjs POST /v3/caseapp/instances/<id>/tasks/trigger --service pims_ --folder-key <FolderKey> --body '{"taskName":"Extra"}'
//   node tools/platform/cloud-api.mjs POST /v3/caseapp/instances/<id>/close --service pims_ --folder-key <FolderKey> --body '{"comment":"…"}'
// 動かす：node tools/maestro/verify.mjs --out <dir> samples/maestro/coverage/CaseApi.case.ts
//        node tools/maestro/debug.mjs <dir>/CaseApi.case/caseplan.json --profile trial（Wait の 10 分の間に API を呼ぶ）

import { casePlan, rule } from "@uipath/maestro-builder-sdk/case";

export default casePlan("case-api")
  .name("CaseApi")
  .identifier("API")
  .caseApp()
  .allowAdhocTasks()
  .stage("Work", (s) =>
    s
      .entryWhen(rule("case-entered"))
      .task("Wait", (t) => t.waitForTimer({ duration: "PT10M" }).entryWhen(rule("current-stage-entered")))
      .task("Extra", (t) => t.waitForTimer({ duration: "PT2S" }).entryWhen(rule("adhoc")))
      .exitWhen(rule("selected-tasks-completed", { tasks: ["Wait"] }), { marksStageComplete: true }),
  )
  .completeWhen(rule("selected-stage-completed", { stage: "Work" }), { marksCaseComplete: true })
  .build();
