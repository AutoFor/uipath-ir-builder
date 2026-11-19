// UiPath のサインイン画面の要素。記録の前に手で定義し、台本（signin.ts）からは名前で指す。
// 記録すると、この名前のまま <P>/ir/repository.json に入る
import { defineObjects } from "../../../tools/pw/objects.ts";

export default defineObjects({
  "UiPath サインイン": {
    "サインイン": {
      url: "https://cloud.uipath.com/",
      elements: {
        "メールで続ける": (p) => p.locator("[data-cy=authorize-with-email]"),
        "Cookie のバナーを閉じる": (p) => p.locator("#onetrust-banner-sdk .banner-close-button"),
        "メール欄": (p) => p.locator("[data-cy=login-email-input]"),
        "サインアップへのリンク": (p) => p.locator("[data-cy=login-goto-signup]"),
        "言語の選択": (p) => p.locator("[data-cy=language-select]"),
        "サインインボタン": (p) => p.locator("[data-cy=login-button]"),
      },
    },
  },
});
