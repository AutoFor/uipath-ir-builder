// IXP のプロジェクトの一覧の要素（AUT-1214）。記録の前に手で定義し、台本（ixp.ts）からは名前で指す。
// 入口は /<org>/<tenant>/reinfer_（IXP の中のサインイン reinfer_/login/oauth2 を通って projects-and-datasets/genex/projects に行く）。
// /reinfer_/ixp は今の入口ではない（開いても白いまま。2026-11-19）
import { defineObjects } from "../../../tools/pw/objects.ts";

export default defineObjects({
  "UiPath Cloud": {
    "ポータル": {
      url: "https://cloud.uipath.com/sorahaneworks/portal_/home",
      elements: {},
    },
    "IXP プロジェクト": {
      url: "https://cloud.uipath.com/sorahaneworks/DefaultTenant/reinfer_",
      elements: {
        // 一覧は web コンポーネント（AP-DATA-GRID）の slot の中（light DOM）。data-testid は言語によらない
        "プロジェクトの表": (p) => p.getByTestId("projects-and-datasets-table"),
        // プロジェクトの名前（ixp_trial_invoices）は、表示の言語によらない
        "請求書のプロジェクト": (p) => p.getByTestId("project-name-with-tooltip").getByText("ixp_trial_invoices", { exact: true }),
      },
    },
  },
});
