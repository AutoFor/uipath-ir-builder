// 小さなフォーム（form.html）を操作し、要素の属性を記録する（AUT-1219 の題材。ロボットで決まった結果になる）。
// 先にページを配る: node tools/pw/serve.mjs samples/pw
// 使い方（リポジトリの根元で）: node samples/pw/form/form.ts <ロケール> [<記録の出力先>]
// 要素は objects.ts に定義し、ここでは名前で指す（セレクターをじかに書かない）
import { launch, UiRecorder } from "../../../tools/pw/recorder.ts";
import objects from "./objects.ts";

const locale = process.argv[2] ?? "ja-JP";
const output = process.argv[3] ?? `samples/pw/form/rec/form.${locale.slice(0, 2)}.json`;
const { browser, page } = await launch(locale);
try {
  const O = objects(page, locale);
  const F = O.IR_Form.フォーム;
  const rec = new UiRecorder(page, locale);
  await rec.goto(F, { urlArg: "in_Url" });
  await rec.clickIfVisible(F.お知らせを閉じる, 3000);
  await rec.fill(F.名前, "IR 太郎", { valueArg: "in_Name" });
  await rec.click(F.送信);
  await rec.waitVisible(F.結果, 10000);
  const r = await rec.text(F.結果, "out_Result");
  await rec.text(F.見出し, "out_Title");
  rec.save(output);
  console.log(`記録した: ${output}（${r}）`);
} finally {
  await browser.close();
}
