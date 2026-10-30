// check だけが止める：人の判断を $vars.review.status で読む。validate は通る
import { flow, hitl, js, script, types } from "@uipath/maestro-builder-sdk";
export default flow("hitl-status").name("HitlStatus")
  .step("review", hitl({ variant: "quick-form", title: "t", fields: [{ id: "c", label: "c", type: "string", direction: "output" }], outcomes: ["Approve", "Reject"] }))
  .branch("d", js`$vars.review.status === "Approve"`, (t) => { t.step("a", script({ code: "return 1;" })); }, (e) => { e.step("b", script({ code: "return 2;" })); })
  .build();
