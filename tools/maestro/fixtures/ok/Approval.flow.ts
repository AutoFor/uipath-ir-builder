import { flow, script, hitl, input, out, js, types } from "@uipath/maestro-builder-sdk";

export default flow("ExpenseApproval")
  .name("ExpenseApproval")
  .input({ amount: types.number })
  .step("review", hitl({ variant: "quick-form", title: "経費の確認", fields: [{ id: "amount", label: "金額", type: "number", direction: "input", value: input("amount") }, { id: "comment", label: "コメント", type: "string", direction: "output" }], outcomes: ["Approve","Reject"] }))
  .branch("isApproved", js`$vars.review.output.Action === "Approve"`, (t) => {
    t.step("pay", script({ code: "return { paid: true };" }));
  }, (e) => {
    e.step("notify", script({ code: "return { paid: false };" }));
  })
  .build();
