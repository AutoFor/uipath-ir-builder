// Maestro Flow の見本：ファイルを受け取るノード（文書の要約、CSV の一括変換、文書の分類）。AI の課金がある。
// テナントで動かすときはファイルを入力に付ける：
//   node tools/maestro/debug.mjs <dir>/Documents.flow/Documents.flow --automate \
//     --attachment docFile=samples/maestro/coverage/data/invoice.txt --attachment csvFile=samples/maestro/coverage/data/items.csv \
//     --attachment pdfFile=samples/maestro/coverage/data/invoice.pdf
// 抽出（ixpExtract / dynamicExtract）は IXP のモデルが要る。このテナントには無いので入れていない（knowledge/maestro.md）。

import { flow, summarize, batchTransform, documentClassify, out, types } from "@uipath/maestro-builder-sdk";

export default flow("Documents")
  .name("Documents")
  .input({ docFile: types.file, csvFile: types.file, pdfFile: types.file })
  .step("sum", summarize({ attachment: out("start", "docFile"), prompt: "Summarize in one sentence." }))
  .step("rows", batchTransform({ attachment: out("start", "csvFile"), prompt: "Classify each item as food, stationery or travel.", outputColumns: [{ name: "category", description: "food, stationery or travel" }], enableWebSearchGrounding: false }))
  .step("kind", documentClassify({ fileRef: out("start", "pdfFile") }))
  .build();
