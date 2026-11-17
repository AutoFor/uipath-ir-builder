// Maestro Automate の見本：RPA のジョブが失敗したときのエラーの道（AUT-1180）。
// DuViaRpa と同じ「RPA Workflow」（Shared/Solution 1、請求書のファイルを受けて番号と合計を返す）に、請求書でないファイルを渡す。
// RPA のジョブが失敗すると、rpaWorkflow の onError に来て $vars.extract.error が読める（本線の続き done は走らない）。
// 動かす：node tools/maestro/verify.mjs --automate --out <dir> samples/maestro/deploy/RpaOnError.flow.ts
//        node tools/maestro/debug.mjs <dir>/RpaOnError.flow/RpaOnError.flow --automate --profile trial --attachment invoice=samples/maestro/coverage/data/items.csv

import { flow, rpaWorkflow, script, out, types } from "@uipath/maestro-builder-sdk";

export default flow("RpaOnError")
  .name("RpaOnError")
  .input({ invoice: types.file })
  .step("extract", rpaWorkflow({
    key: "06ab8ea9-8dd9-4f52-a549-c23f861b1f9d",
    name: "RPA Workflow",
    folderPath: "Shared/Solution 1",
    inputs: { in_Invoice: out("start", "invoice") },
    returns: { out_InvoiceNumber: "string", out_Total: "string" },
  }))
  .onError((h) => { h.step("caught", script({ code: "const e = $vars.extract.error ?? {}; return { code: e.code, status: e.status, message: e.message, detail: String(e.detail ?? '').slice(0, 300) };" })); })
  .step("done", script({ code: "return { total: $vars.extract.output.out_Total };" }))
  .build();
