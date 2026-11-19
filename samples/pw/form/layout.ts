// レイアウト（layout.html）を操作し、要素の属性を記録する（AUT-1221 の題材：アンカー・複数行のセレクター・iframe）。
// 先にページを配る: node tools/pw/serve.mjs samples/pw
// 使い方（リポジトリの根元で）: node samples/pw/form/layout.ts <ロケール> [<記録の出力先>]
import { launch, UiRecorder } from "../../../tools/pw/recorder.ts";
import objects from "./layout-objects.ts";

const locale = process.argv[2] ?? "ja-JP";
const output = process.argv[3] ?? `samples/pw/form/rec/layout.${locale.slice(0, 2)}.json`;
const { browser, page } = await launch(locale);
try {
  const L = objects(page, locale).IR_Layout.レイアウト;
  const rec = new UiRecorder(page, locale);
  await rec.goto(L, { urlArg: "in_Url" });
  await rec.fill(L.氏名欄, "IR 太郎", { valueArg: "in_Name" });
  await rec.fill(L.メール欄, "ir@example.com", { valueArg: "in_Mail" });
  await rec.click(L.確認);
  const s1 = await rec.text(L.状態, "out_Status");
  await rec.click(L.プランBを選ぶ);
  const s2 = await rec.text(L.状態, "out_Choice");
  await rec.text(L.プランAの見出し, "out_PlanA");
  await rec.fill(L.フレームの入力欄, "F1", { valueArg: "in_Frame" });
  await rec.click(L.フレームの送る);
  const s3 = await rec.text(L.フレームの結果, "out_Frame");
  rec.save(output);
  console.log(`記録した: ${output}（${s1} / ${s2} / ${s3}）`);
} finally {
  await browser.close();
}
