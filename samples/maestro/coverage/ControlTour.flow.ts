// Maestro Flow の見本：制御とテナントの資源の要らないノードを 1 本で通す（knowledge/maestro.md の対応表）。
// transform / branch / switch / parallel / loop / delay / http / subflow / script / onError。
//
//   node tools/maestro/verify.mjs --automate samples/maestro/coverage/ControlTour.flow.ts
//   （テナントで動かすときは uip maestro flow debug <プロジェクト> -i '{"amount":300}'）

import { flow, script, transform, delay, http, subflow, input, js, v, types } from "@uipath/maestro-builder-sdk";

// 子のフロー：数を 2 倍にして返す
const double = flow("Double")
  .input({ n: types.number })
  .output({ twice: types.number })
  .step("calc", script({ code: "return { value: $vars.start.output.n * 2 };" }))
  .return({ twice: js`$vars.calc.output.value` });

export default flow("ControlTour")
  .name("ControlTour")
  .input({ amount: types.number })
  .var("items", types.array, [{ name: "a", price: 100 }, { name: "b", price: 300 }, { name: "c", price: 50 }])
  .step("expensive", transform({ collection: v("items"), operations: [{ type: "filter", operation: "and", filters: [{ field: "price", condition: "greater_than", value: 80 }] }] }))
  .branch("isBig", js`$vars.start.output.amount > 100`,
    (t) => { t.step("bigNote", script({ code: 'return { size: "big" };' })); },
    (e) => { e.step("smallNote", script({ code: 'return { size: "small" };' })); })
  .switch("route", undefined, [
    { when: js`$vars.start.output.amount > 500`, label: "High", body: (b) => b.step("high", script({ code: 'return { level: "high" };' })) },
    { when: js`$vars.start.output.amount <= 500`, label: "Low", body: (b) => b.step("low", script({ code: 'return { level: "low" };' })) },
  ])
  .parallel("both", [
    (b) => b.step("p1", script({ code: "return { arm: 1 };" })),
    (b) => b.step("p2", script({ code: "return { arm: 2 };" })),
  ])
  .loop("each", v("items"), (b) => b.step("visit", script({ code: "return { seen: true };" })))
  .step("wait", delay({ duration: "PT5S" }))
  .step("fetch", http({ url: "https://docs.uipath.com/llms.txt", method: "GET", managed: false }))
  .step("callDouble", subflow(double, { n: input("amount") }))
  .step("summary", script({ code: 'return { count: $vars.expensive.output.length, twice: $vars.callDouble.output.twice, status: $vars.fetch.output.statusCode };' }))
  // わざと失敗させ、エラーの道に回す
  .step("fail", script({ code: 'throw new Error("わざと失敗");' }))
  .onError((h) => { h.step("caught", script({ code: 'return { handled: true };' })); })
  .build();
