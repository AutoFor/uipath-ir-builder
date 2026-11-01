// 割り当て（AUT-1090）：QuickForm をユーザーに割り当てる。recipient を省くと未割り当てで作られる（SDK の文書）
import { flow, hitl } from "@uipath/maestro-builder-sdk";
export default flow("assign-user").name("AssignUser")
  .step("review", hitl({
    variant: "quick-form",
    title: "割り当ての確認",
    fields: [{ id: "comment", label: "コメント", type: "string", direction: "output" }],
    outcomes: ["Approve", "Reject"],
    recipient: { channels: ["ActionCenter"], assignee: { type: "user", value: "user@example.com" } },
  }))
  .build();
