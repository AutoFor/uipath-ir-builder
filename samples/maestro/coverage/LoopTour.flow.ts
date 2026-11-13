// Maestro Flow の見本：doWhile、変数の更新（updates）、mock、出力（output / return）、terminate。
// テナントの資源は要らない。

import { flow, script, mock, js, v, types } from "@uipath/maestro-builder-sdk";

export default flow("LoopTour")
  .name("LoopTour")
  .input({ stopAt: types.number })
  .output({ count: types.number })
  .var("n", types.number, 0)
  // n を 1 ずつ増やし、stopAt に届くまで繰り返す
  .doWhile("count", js`$vars.n < $vars.start.output.stopAt`, (b) => b
    .step("tick", script({ code: "return { at: $vars.n };" }), { updates: { n: js`$vars.n + 1` } }), { limit: 20 })
  .step("placeholder", mock())
  .branch("tooMany", js`$vars.n > 10`,
    (t) => { t.terminate("stopEarly", "多すぎる"); },
    (e) => { e.step("ok", script({ code: "return { fine: true };" })); })
  .return({ count: v("n") });
