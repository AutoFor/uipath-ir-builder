// 宣言していない変数を読む
import { bpmn } from "@uipath/maestro-builder-sdk/bpmn";
export default bpmn("undeclared").name("UndeclaredVar")
  .startEvent("start").exclusiveGateway("g", { default: "f" }).endEvent("e1").endEvent("e2")
  .sequenceFlow("start", "g")
  .sequenceFlow("g", "e1", { condition: "=vars.nope == 1" })
  .sequenceFlow("g", "e2", { id: "f" })
  .build();
