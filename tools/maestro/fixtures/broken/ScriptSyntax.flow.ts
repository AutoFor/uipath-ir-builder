// script の文法の間違い
import { flow, hitl, js, script, types } from "@uipath/maestro-builder-sdk";
export default flow("script-syntax").name("ScriptSyntax")
  .step("s", script({ code: "return {{{ ;" }))
  .build();
