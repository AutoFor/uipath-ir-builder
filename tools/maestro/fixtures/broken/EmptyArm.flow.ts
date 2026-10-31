// 分岐の片方が空
import { flow, hitl, js, script, types } from "@uipath/maestro-builder-sdk";
export default flow("empty-arm").name("EmptyArm")
  .input({ ok: types.boolean })
  .branch("d", js`$vars.start.output.ok`, (t) => { t.step("a", script({ code: "return 1;" })); }, (e) => {})
  .build();
