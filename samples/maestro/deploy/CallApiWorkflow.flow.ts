// Maestro Flow の見本：生成器で作った API ワークフロー（samples/apiwf/ControlTour.json）を Flow から呼ぶ。
// API ワークフローはトライアルの組織 sorahaneworks の Shared/ApiwfControlTour にデプロイした「Probe」
// （key は `uip or processes list --folder-path Shared/ApiwfControlTour` の Key。テナントが変われば作り直す）。knowledge/api-workflow.md
// 動かす：node tools/maestro/verify.mjs --out <dir> samples/maestro/deploy/CallApiWorkflow.flow.ts
//        node tools/maestro/debug.mjs <dir>/CallApiWorkflow.flow/CallApiWorkflow.flow --automate --profile trial

import { flow, apiWorkflow, script, types } from "@uipath/maestro-builder-sdk";

export default flow("CallApiWorkflow")
  .name("CallApiWorkflow")
  .input({ limit: types.number })
  .step("calc", apiWorkflow({
    key: "2b4b9ae2-b44c-457f-92d6-b60e48d754a6",
    name: "Probe",
    folderPath: "Shared/ApiwfControlTour",
    inputs: {
      items: [{ name: "a", price: 50 }, { name: "b", price: 200 }, { name: "c", price: 300 }, { name: "d", price: 900 }, { name: "e", price: 150 }],
      limit: 500,
    },
    returns: { total: "number", tier: "string", loops: "number" },
  }))
  .step("check", script({ code: `
    const r = $vars.calc.output ?? {};
    if (r.total !== 500 || r.tier !== "GOLD") throw new Error("API workflow returned " + JSON.stringify(r));
    return { total: r.total, tier: r.tier, loops: r.loops };
  ` }))
  .build();
