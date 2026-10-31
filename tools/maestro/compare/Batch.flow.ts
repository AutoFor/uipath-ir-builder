// 比較用（AUT-1078）：SDK の直書き。入力の配列をループし、1件ごとに script。script の失敗は人に回す
import { flow, hitl, script, input, types } from "@uipath/maestro-builder-sdk";

export default flow("Batch")
  .name("Batch")
  .input({ items: types.array })
  .loop("each", input("items"), (b) => {
    b.step("checkItem", script({ code: "return { ok: $vars.each.currentItem != null };" }));
  })
  .step("post", script({ code: "return { posted: true };" }))
  .onError((h) => {
    h.step("askHuman", hitl({ variant: "quick-form", title: "投稿に失敗", fields: [{ id: "note", label: "メモ", type: "string", direction: "output" }], outcomes: ["OK"] }));
  })
  .build();
