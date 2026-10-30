// 比較用（AUT-1078）：SDK の直書き。Flow と同じ中身
import { bpmn } from "@uipath/maestro-builder-sdk/bpmn";

export default bpmn("Batch")
  .name("Batch")
  .input("items", "array")
  .var("note", "string")
  .startEvent("start")
  .scriptTask("checkItem", { script: "return { ok: iterator[0] != null };", inputs: { "iterator[0]": "=iterator[0]" }, loop: { collection: "=vars.items", itemVar: "item", sequential: true } })
  .scriptTask("post", { script: "return { posted: true };" }, (t) => {
    t.onError((b) => {
      b.humanTask("askHuman", { title: "投稿に失敗", form: { fields: [{ id: "note", label: "メモ", type: "string", direction: "output" }], outcomes: ["OK"] } });
      b.endEvent("failed");
    });
  })
  .endEvent("end")
  .sequenceFlow("start", "checkItem")
  .sequenceFlow("checkItem", "post")
  .sequenceFlow("post", "end")
  .build();
