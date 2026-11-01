// 割り当て（AUT-1090）：Action App のタスクをグループに割り当てる。staticGroupName は名前をそのまま書く形
import { flow, hitl } from "@uipath/maestro-builder-sdk";
export default flow("assign-group").name("AssignGroup")
  .step("review", hitl({
    variant: "action-app",
    title: "割り当ての確認",
    app: {
      name: "uipath-ir-test-approval",
      key: "ddab4478-d11a-4014-b717-2bc489edfade",
      folderPath: "Shared",
      inputs: { note: "'Flow から'" },
      actionSchema: {
        inputs: { type: "object", properties: { note: { type: "string", required: false } } },
        outputs: { type: "object", properties: { comment: { type: "string", required: false } } },
        inOuts: { type: "object", properties: {} },
        outcomes: { type: "object", properties: { Approve: { type: "string" }, Reject: { type: "string" } } },
      },
    },
    outcomes: ["Approve", "Reject"],
    recipient: { channels: ["ActionCenter"], assignee: { type: "group", value: "Reviewers" } },
  }))
  .build();
