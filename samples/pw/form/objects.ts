// フォーム（form.html）の要素。記録の前に手で定義し、台本（form.ts）からは名前で指す（UiPath のオブジェクトリポジトリと同じ）。
// 記録すると、この名前のまま <P>/ir/repository.json に入る。そのあとは repository.json が正本（pw-objects.ts で <P>/pw/objects を作る）
import { defineObjects } from "../../../tools/pw/objects.ts";

export default defineObjects({
  "IR Form": {
    "フォーム": {
      url: "http://127.0.0.1:8765/form/form.html",
      elements: {
        "お知らせを閉じる": (p) => p.locator("#banner .banner-close"),
        "名前": (p) => p.getByTestId("name-input"),
        "送信": (p) => p.locator("button[aria-label]").first(),
        "結果": (p) => p.getByTestId("result"),
        "見出し": (p) => p.locator("h1"),
      },
    },
  },
});
