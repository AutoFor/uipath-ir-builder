// 変数名の間違い
import { flow, hitl, js, script, types } from "@uipath/maestro-builder-sdk";
export default flow("undeclared").name("UndeclaredVar")
  .step("s", script({ code: "return $vars.nope.output;" }))
  .build();
