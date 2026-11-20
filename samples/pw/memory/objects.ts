// Agents（agents_）のメモリ空間の要素（AUT-1214 の作る題材 A）。メモリ空間は CLI で作れず、画面でしか作れない。
// 2026-11-20 に DOM を見て決めた：
// - 作成の画面（/memory/add）の欄には、テスト用の属性も言語によらない属性も無い（id は :r1: のような作られた値）
// - 一覧の行は AP-DATA-GRID の slot（light DOM）。行ごとの削除ボタンは aria-label が同じなので、作った行の名前を目印に、いちばん近いものを押す
//   （検索の欄で絞ると、絞り込みが少し遅れて効き、押すまでの間に一覧が描き直される。件数の表示は shadow DOM の中で待てない）
// - 削除の確かめの画面（AP-ALERT-POPUP）のボタンは shadow DOM の中で、UiPath では指せない。
//   確かめの欄の外側（AP-TEXT-FIELD。light DOM で 1 つ）に名前を打ち、Tab・Tab で「削除」に移って Enter（キーの間を空けないと押せない。2026-11-20）
import { defineObjects } from "../../../tools/pw/objects.ts";

// テスト用と分かる名前（ircu-）。台本の最後で消す
export const NAME = "ircu-memory-check";

export default defineObjects({
  "UiPath Cloud": {
    "ポータル": {
      url: "https://cloud.uipath.com/sorahaneworks/portal_/home",
      elements: {},
    },
    "メモリ空間の作成": {
      url: "https://cloud.uipath.com/sorahaneworks/agents_/memory/add",
      elements: {
        // 名前・説明・フォルダーの順に並ぶ。名前の欄はページの最初の 1 行の入力欄
        "名前の欄": (p) => p.locator("input[type=text]:not([role])").first(),
        "説明の欄": (p) => p.locator("textarea:not([aria-hidden])"),
        // 名前・説明・フォルダーの欄は、UiPath では placeholder で指す（2 言語の正規表現。近くのラベルを目印にした形は、2 言語の正規表現だとロボットで見つからなかった）
        "フォルダーの欄": (p) => p.locator("input[role=combobox]"),
        // フォルダーの名前は言語によらない
        "Shared の選択肢": (p) => p.getByRole("option", { name: "Shared", exact: true }),
        "保存": (p) => p.getByRole("button", { name: /^(保存|Save)$/ }),
      },
    },
    "メモリ空間": {
      url: "https://cloud.uipath.com/sorahaneworks/agents_/memory",
      elements: {
        "作ったメモリ空間": (p) => p.locator("ap-typography").filter({ hasText: new RegExp(`^${NAME}$`) }),
        // 行ごとの削除ボタン（どの行も同じ）。台本では作った行の名前を目印に押す（click(…, { near })）
        "行の削除": (p) => p.locator('[slot^="rowButton__slot__delete-memory"] button'),
        // 削除の確かめの欄（外側の部品）
        "削除の確定": (p) => p.locator("ap-text-field"),
      },
    },
  },
});
