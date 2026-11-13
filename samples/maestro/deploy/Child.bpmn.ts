// デプロイして確かめる見本：別の BPMN から呼ばれる子のプロセス。入力 n を 2 倍にして返す。
import { bpmn } from "@uipath/maestro-builder-sdk/bpmn";

export default bpmn("Child")
  .name("Child")
  .input("n", "number")
  .var("value", "number")
  .output("doubled", "number")
  .startEvent("start")
  .scriptTask("calc", { script: "return { doubled: vars.n * 2 };", outputs: { value: "=result.response.doubled" } })
  // 戻り値は終了イベントの mapping で返す。.output() は宣言だけで、これが無いとジョブの出力は {}（Studio Web が書く形。knowledge/maestro.md）
  .endEvent("done", { payload: { type: "BPMN.Variables", outputRows: [{ name: "doubled", type: "number", source: "=vars.value", var: "doubled", custom: true }] } })
  .sequenceFlow("start", "calc")
  .sequenceFlow("calc", "done")
  .build();
