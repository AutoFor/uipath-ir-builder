// Maestro Flow の見本：テナントの資源か AI の課金が要るノードの書き方。手元の検証（verify.mjs）だけ通す。動かしていない。
// キーと名前は架空。実際に使うときは registry search / or processes list で実在のものに置き換える（docs/maestro-tenant-resources.md）。

import { flow, queueItem, inlineAgent, apiWorkflow, publishedFunction, summarize, batchTransform, out, types } from "@uipath/maestro-builder-sdk";

export default flow("LocalOnly")
  .name("LocalOnly")
  .input({ documentFile: types.file, csvFile: types.file })
  .step("enqueue", queueItem({ queue: "SupplierInvoices", folderPath: "Shared", key: "fa1a7328-cd17-4525-b5ab-29d86e399312", item: { invoice: "INV-1" } }))
  .step("triage", inlineAgent({ model: "gpt-5.4", systemPrompt: "メールを 1 つの区分に分ける。", userPrompt: "件名：請求書の再送" }))
  .step("getAge", apiWorkflow({ key: "ce857908-ee1d-4392-b552-38bcea0be29c", name: "NameToAgeFixed", folderPath: "Shared", inputs: { name: "太郎" } }))
  .step("echo", publishedFunction({ key: "7059bdb5-fdd7-4e13-9d7b-1748aaeb129d", name: "acme-echo", folderPath: "Shared/acme-echo", inputs: { text: "hi" } }))
  .step("summarizeDoc", summarize({ attachment: out("start", "documentFile"), prompt: "5 行で要約する。", returnCitations: true }))
  .step("categorize", batchTransform({ attachment: out("start", "csvFile"), prompt: "各行を分類する。", outputColumns: [{ name: "category", description: "区分" }] }))
  .build();
