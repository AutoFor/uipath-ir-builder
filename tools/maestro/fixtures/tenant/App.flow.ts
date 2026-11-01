// テナントの資源（AUT-1079）：テスト用の Coded Action App（uipath-ir-test-approval）を開く人のタスク。キーは solution resources list の Key
import { flow, hitl } from "@uipath/maestro-builder-sdk";
export default flow("app-node").name("AppNode")
  .step("review", hitl({
    variant: "action-app",
    title: "AUT-1079 Flow の確認",
    app: {
      name: "uipath-ir-test-approval",
      key: "ddab4478-d11a-4014-b717-2bc489edfade",
      folderPath: "seiya-kawashima@autofor.co.jp's workspace",
      inputs: { note: "'Flow から'" },
      actionSchema: {
        inputs: { type: "object", properties: { note: { type: "string", required: false } } },
        outputs: { type: "object", properties: { comment: { type: "string", required: false } } },
        inOuts: { type: "object", properties: {} },
        outcomes: { type: "object", properties: { Approve: { type: "string" }, Reject: { type: "string" } } },
      },
    },
    outcomes: ["Approve", "Reject"],
  }))
  .build();
