// 式の型の間違い：数値の入力に文字列のメソッド
import { flow, hitl, js, script, types } from "@uipath/maestro-builder-sdk";
export default flow("script-type").name("ScriptType")
  .input({ amount: types.number })
  .step("s", script({ code: "return $vars.start.output.amount.toUpperCase();" }))
  .build();
