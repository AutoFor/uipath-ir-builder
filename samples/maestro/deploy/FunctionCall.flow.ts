// Maestro Flow の見本：デプロイした JS/TS の関数（Coded Functions）を Function ノードで呼ぶ（AUT-1211）。
// 関数は samples/function-ts/quote/（見積りの合計に会員の割引を掛ける）。pack → or packages upload → or processes create で
// 試しの組織 sorahaneworks の Shared に「AUT1211Quote」として出した（knowledge/functions.md）。key はそのプロセスの Key
// （uip maestro flow registry search AUT1211Quote の uipath.core.function.<key>）。テナントが変われば作り直す。
// 動かす：node tools/maestro/verify.mjs --out <dir> samples/maestro/deploy/FunctionCall.flow.ts
//        node tools/maestro/debug.mjs <dir>/FunctionCall.flow/FunctionCall.flow --profile trial -i '{"tier":"GOLD"}'

import { flow, publishedFunction, script, input, types } from "@uipath/maestro-builder-sdk";

export default flow("FunctionCall")
  .name("FunctionCall")
  .input({ tier: types.string })
  .step("quote", publishedFunction({
    key: "f41d9908-0b2d-49dc-be65-082ffe59bcfa",
    name: "AUT1211Quote",
    folderPath: "Shared",
    inputs: { items: [{ price: 1000, quantity: 3 }, { price: 500, quantity: 2 }], tier: input("tier") },
    returns: { subtotal: "number", discount: "number", total: "number" },
  }))
  .step("check", script({ code: `
    const q = $vars.quote.output ?? {};
    if (q.subtotal !== 4000) throw new Error("QUOTE=" + JSON.stringify(q));
    return { total: q.total, discount: q.discount };
  ` }))
  .build();
