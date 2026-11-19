// UiPath のサインイン画面を操作し、要素の属性を記録する（AUT-1219 の題材）。
// 使い方（リポジトリの根元で）: node samples/pw/signin/signin.ts <ロケール> [<記録の出力先>]
//   node samples/pw/signin/signin.ts ja-JP && node samples/pw/signin/signin.ts en-US
// パスワードは入れない。メール欄には example.com の仮のアドレスを入れるだけで、送らない。
// 要素は objects.ts に定義し、ここでは名前で指す（セレクターをじかに書かない）
import { launch, UiRecorder } from "../../../tools/pw/recorder.ts";
import objects from "./objects.ts";

const locale = process.argv[2] ?? "ja-JP";
const output = process.argv[3] ?? `samples/pw/signin/rec/signin.${locale.slice(0, 2)}.json`;
const { browser, page } = await launch(locale);
try {
  const S = objects(page, locale).UiPath_サインイン.サインイン;
  const rec = new UiRecorder(page, locale);
  await rec.goto(S, { urlArg: "in_Url" });
  await rec.waitVisible(S.メールで続ける);
  // Cookie のバナー（OneTrust）は、出る・出ないがブラウザーの状態で変わり、出るとボタンの上に重なる。出たときだけ × で閉じる（同意はしない）
  await rec.clickIfVisible(S.Cookie_のバナーを閉じる, 8000);
  await rec.click(S.メールで続ける);
  await rec.fill(S.メール欄, "user@example.com", { valueArg: "in_Email" });
  await rec.text(S.サインアップへのリンク, "out_SignUp");
  await rec.text(S.言語の選択, "out_Language");
  await rec.waitVisible(S.サインインボタン);
  rec.save(output);
  console.log(`記録した: ${output}`);
} finally {
  await browser.close();
}
