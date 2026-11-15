// Maestro Flow の見本：HTTP ノード（v2、managed: true）の成功・状態コードの分岐・失敗の道（knowledge/maestro.md）。
//
//   node tools/maestro/verify.mjs --automate --out out/maestro samples/maestro/coverage/HttpV2.flow.ts
//   node tools/maestro/debug.mjs out/maestro/HttpV2.flow/HttpV2.flow --automate
//
// 相手は試し用の公開サービス httpbin.org（/status/<コード> がその状態コードを返す）。
// 状態コードは SDK の書き方（output.statusCode）で書く。テナントでは output.code なので、verify.mjs が直す（fixHttpV2）。

import { flow, script, http, js } from "@uipath/maestro-builder-sdk";

export default flow("HttpV2")
  .name("HttpV2")
  // 200：成功の道。テナントの output は { code, headers, body }
  .step("ok", http({ url: "https://httpbin.org/status/200", method: "GET", managed: true, timeout: "PT30S" }))
  // 状態コードで出口を分ける。名前が出口 branch-<name> になり、当たらなければ既定の出口に行く
  .step("routed", http({
    url: "https://httpbin.org/status/202", method: "GET", managed: true,
    branches: [{ name: "accepted", condition: js`$vars.routed.output.statusCode === 202` }],
  }))
  .stepToList("branch-accepted", (b) => b.step("onAccepted", script({ code: 'return { branch: "accepted" };' })).stepToRef("notFound"))
  // 404：v2 は 2xx 以外で失敗になり、onError に来る（v1 は成功の道に来た）
  .step("notFound", http({ url: "https://httpbin.org/status/404", method: "GET", managed: true, retryCount: 0 }))
  .onError((h) => {
    // 失敗した step は $vars.<step> = { error: true, output: { code: "404", message, detail, category: "User", status: 404, element } }（テナントで確かめた）。
    // ただし check / validate はこの形を知らない（error だけとし、$vars.notFound.output を読むと止める）ので、ここでは読まない
    h.step("caught", script({ code: "return { handled: true, okCode: $vars.ok.output.statusCode };" }));
  })
  .step("after", script({ code: 'return { reached: true };' }))
  .build();
