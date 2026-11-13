// Maestro Flow の見本：フォルダにデプロイした IXP のモデルで、請求書の PDF から項目を抜く。
// project は `uip maestro flow registry search "uipath.ixp"` の NodeType をそのまま写す（トライアルの組織 sorahaneworks の Shared に
// デプロイした ixp_trial。テナントが変われば作り直す）。modelName は DeploymentName、name は DeploymentTitle。
// 動かす：node tools/maestro/verify.mjs --out <dir> samples/maestro/deploy/IxpExtract.flow.ts
//        node tools/maestro/debug.mjs <dir>/IxpExtract.flow/IxpExtract.flow --automate --profile trial \
//          --attachment invoice=samples/maestro/coverage/data/invoice.pdf
// 結果は $vars.<id>.output.ExtractionResult.ResultsDocument.Fields[]。最上位はフィールド グループ（FieldType "FieldGroup"、
// FieldName は "Invoice" や "Invoice > Line Items"）で、項目はその Values[]（1 件 = 1 回の出現、明細なら 1 行）の Components[] に
// { FieldName, Values: [{ Value }] } で入る。knowledge/maestro.md 10 節

import { flow, ixpExtract, script, out, types } from "@uipath/maestro-builder-sdk";

export default flow("IxpExtract")
  .name("IxpExtract")
  .input({ invoice: types.file })
  .step("extract", ixpExtract({
    project: "uipath.ixp.ixp-trial-69ef3e2c-ixp.c86e5877-06fd-8044-889b-5e20114a472f-0a85adf2-1375-4b3f-8762-2c7888d40cc4",
    modelName: "ixp_trial-69ef3e2c-ixp",
    name: "ixp_trial",
    folderName: "Shared",
    fileRef: out("start", "invoice"),
  }))
  .step("read", script({ code: `
    const groups = $vars.extract.output?.ExtractionResult?.ResultsDocument?.Fields ?? [];
    // グループの出現ごとに { 項目名: 値 } にする
    const rows = (name) => (groups.find(g => g.FieldName === name)?.Values ?? [])
      .map(v => Object.fromEntries((v.Components ?? []).map(c => [c.FieldName, c.Values?.[0]?.Value ?? null])));
    const head = rows("Invoice")[0] ?? {};
    const lines = rows("Invoice > Line Items");
    if (!String(head["Total Amount"] ?? "").startsWith("8100")) throw new Error("TOTAL=" + JSON.stringify(head));
    return { invoiceNo: head["Invoice Number"], total: head["Total Amount"], lines: lines.length };
  ` }))
  .build();
