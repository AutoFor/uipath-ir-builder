// Maestro Flow の見本：Document Understanding の抽出器（クラシックの形）を、生成器で作った RPA から使う。
// RPA は samples/ir/UiPath.DocumentUnderstanding.Activities/ExtractDocumentDataWithDocumentData.min.json に出力の引数
// （out_InvoiceNumber、out_Total）を足したもの。トライアルの組織 sorahaneworks の Shared/Solution 1 にデプロイした
// 「RPA Workflow」を呼ぶ（key は `uip or processes list --all-folders --process-type Process` の Key。テナントが変われば作り直す）。
// Flow のファイルの入力を、RPA の IResource の引数（in_Invoice）にそのまま渡す。knowledge/document-understanding.md
// 動かす：node tools/maestro/verify.mjs --out <dir> samples/maestro/deploy/DuViaRpa.flow.ts
//        node tools/maestro/debug.mjs <dir>/DuViaRpa.flow/DuViaRpa.flow --automate --profile trial --attachment invoice=<請求書の PDF>

import { flow, rpaWorkflow, script, out, types } from "@uipath/maestro-builder-sdk";

export default flow("DuViaRpa")
  .name("DuViaRpa")
  .input({ invoice: types.file })
  .step("extract", rpaWorkflow({
    key: "06ab8ea9-8dd9-4f52-a549-c23f861b1f9d",
    name: "RPA Workflow",
    folderPath: "Shared/Solution 1",
    inputs: { in_Invoice: out("start", "invoice") },
    returns: { out_InvoiceNumber: "string", out_Total: "string" },
  }))
  .step("read", script({ code: `
    const r = $vars.extract.output ?? {};
    if (!String(r.out_Total ?? "").startsWith("8100")) throw new Error("TOTAL=" + JSON.stringify(r));
    return { invoiceNo: r.out_InvoiceNumber, total: r.out_Total };
  ` }))
  .build();
