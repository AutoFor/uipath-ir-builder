// UiPath のサインイン画面を操作し、要素の属性を記録する（AUT-1219 の題材）。
// 使い方（リポジトリの根元で）: node samples/pw/signin/signin.ts <ロケール> [<記録の出力先>]
//   node samples/pw/signin/signin.ts ja-JP && node samples/pw/signin/signin.ts en-US
// パスワードは入れない。メール欄には example.com の仮のアドレスを入れるだけで、送らない。
import { launch, UiRecorder } from "../../../tools/pw/recorder.ts";

const locale = process.argv[2] ?? "ja-JP";
const output = process.argv[3] ?? `samples/pw/signin/rec/signin.${locale.slice(0, 2)}.json`;
const { browser, page } = await launch(locale);
try {
  const rec = new UiRecorder(page, locale);
  const S = "サインイン";
  await rec.goto(S, "https://cloud.uipath.com/", { urlArg: "in_Url" });
  await rec.waitVisible(S, "メールで続ける", page.locator("[data-cy=authorize-with-email]"));
  // Cookie のバナーは、出る・出ないがブラウザーのプロファイルで変わる。記録では閉じず、変換できないものとして残す
  rec.unsupported("Cookie のバナー", "OneTrust のバナーは、出るかどうかがブラウザーの状態で変わる。UiPath では、出たときだけ閉じる手順（Check App State）を人が足す");
  await rec.click(S, "メールで続ける", page.locator("[data-cy=authorize-with-email]"));
  await rec.fill(S, "メール欄", page.locator("[data-cy=login-email-input]"), "user@example.com", { valueArg: "in_Email" });
  await rec.text(S, "サインアップへのリンク", page.locator("[data-cy=login-goto-signup]"), "out_SignUp");
  await rec.text(S, "言語の選択", page.locator("[data-cy=language-select]"), "out_Language");
  await rec.waitVisible(S, "サインインボタン", page.locator("[data-cy=login-button]"));
  rec.save(output);
  console.log(`記録した: ${output}`);
} finally {
  await browser.close();
}
