// Maestro Flow の見本：ループの中の変数（currentItem・currentIteration は 1 から）と、ループの後の output（各回の結果の配列）。currentIndex は無い（テナントで確かめた）。
import { flow, script, v, types } from "@uipath/maestro-builder-sdk";
export default flow("LoopVars").name("LoopVars")
  .var("items", types.array, ["a", "b", "c"])
  .loop("each", v("items"), (b) => b.step("peek", script({ code: "return { item: $vars.each.currentItem, iter: $vars.each.currentIteration };" })))
  .step("after", script({ code: "return { out: $vars.each.output };" }))
  .build();
