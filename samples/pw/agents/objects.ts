// Agents（agents_）のテンプレートの一覧の要素（AUT-1214）。読むだけ。テンプレートの一覧は CLI（uip agent）に無く、画面でしか見られない。
// 表（grid-container）は shadow DOM の中にあり、UiPath のセレクターでは見つからなかった。テンプレートのカード（shadow DOM の外）を使う
import { defineObjects } from "../../../tools/pw/objects.ts";

export default defineObjects({
  "UiPath Cloud": {
    "ポータル": {
      url: "https://cloud.uipath.com/sorahaneworks/portal_/home",
      elements: {},
    },
    "Agents のテンプレート": {
      url: "https://cloud.uipath.com/sorahaneworks/agents_/templates",
      elements: {
        // テンプレートはカードで出る（H4 > BUTTON > SPAN aria-label="テンプレートの名前"）。名前は英語のまま
        "言語判定のテンプレート": (p) => p.locator('span[aria-label="Language Detection Agent"]'),
      },
    },
  },
});
