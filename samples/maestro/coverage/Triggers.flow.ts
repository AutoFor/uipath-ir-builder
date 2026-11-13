// Maestro Flow の見本：トリガーの書き方（定期実行と、人が入れるフォーム）。entryPoint で 1 つの flow に入口を 2 つ持たせる。
// 定期実行はデプロイしないと動かない。debug は既定の入口（manual）から動く。

import { flow, script, scheduled, formTrigger, entryInput, types } from "@uipath/maestro-builder-sdk";

export default flow("Triggers")
  .name("Triggers")
  .entryPoint("nightly", scheduled({ every: "R/P1D" }))
  .entryPoint("asked", formTrigger(), { inputs: { note: types.string } })
  .step("hello", script({ code: 'return { from: "trigger" };' }))
  .build();
