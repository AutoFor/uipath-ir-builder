// 小さなフォーム（form.html）を操作し、要素の属性を記録する（AUT-1219 の題材。ロボットで決まった結果になる）。
// 先にページを配る: node tools/pw/serve.mjs samples/pw
// 使い方（リポジトリの根元で）: node samples/pw/form/form.ts <ロケール> [<記録の出力先>]
import { launch, UiRecorder } from "../../../tools/pw/recorder.ts";

const locale = process.argv[2] ?? "ja-JP";
const output = process.argv[3] ?? `samples/pw/form/rec/form.${locale.slice(0, 2)}.json`;
const { browser, page } = await launch(locale);
try {
  const rec = new UiRecorder(page, locale);
  const S = "フォーム";
  await rec.goto(S, "http://127.0.0.1:8765/form/form.html", { urlArg: "in_Url" });
  await rec.clickIfVisible(S, "お知らせを閉じる", page.locator("#banner .banner-close"), 3000);
  await rec.fill(S, "名前", page.getByTestId("name-input"), "IR 太郎", { valueArg: "in_Name" });
  await rec.click(S, "送信", page.locator("button[aria-label]").first());
  await rec.waitVisible(S, "結果", page.getByTestId("result"), 10000);
  const r = await rec.text(S, "結果", page.getByTestId("result"), "out_Result");
  await rec.text(S, "見出し", page.locator("h1"), "out_Title");
  rec.save(output);
  console.log(`記録した: ${output}（${r}）`);
} finally {
  await browser.close();
}
