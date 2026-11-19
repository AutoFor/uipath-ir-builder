// レイアウト（layout.html）の要素。記録の前に手で定義し、台本（layout.ts）からは名前で指す（AUT-1221）。
// アンカー（ラベルの右の入力欄）、カードの中のボタン、iframe の中の要素を含む。記録すると、この名前のまま repository.json に入る
import { defineObjects } from "../../../tools/pw/objects.ts";

export default defineObjects({
  "IR Layout": {
    "レイアウト": {
      url: "http://127.0.0.1:8765/form/layout.html",
      elements: {
        "氏名欄": (p) => p.locator("input.field:right-of(label:text-matches('^(氏名|Name)$'))").first(),
        "メール欄": (p) => p.locator("input.field:right-of(label:text-matches('^(メール|Email)$'))").first(),
        "確認": (p) => p.getByTestId("check"),
        "状態": (p) => p.getByTestId("status"),
        "プランBを選ぶ": (p) => p.getByTestId("card-b").getByRole("button"),
        "プランAの見出し": (p) => p.getByTestId("card-a").locator("h2"),
        "フレームの入力欄": (p) => p.frameLocator("#inner").getByTestId("frame-input"),
        "フレームの送る": (p) => p.frameLocator("#inner").getByTestId("frame-ok"),
        "フレームの結果": (p) => p.frameLocator("#inner").getByTestId("frame-result"),
      },
    },
  },
});
