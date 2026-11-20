// Studio Web の Cloud Workspace（ソリューションの一覧）の要素（AUT-1214）。読むだけ。
// ソリューションの一覧は CLI に無い（uip solution に list が無い）ので、画面でしか見られない
import { defineObjects } from "../../../tools/pw/objects.ts";

export default defineObjects({
  "UiPath Cloud": {
    "ポータル": {
      url: "https://cloud.uipath.com/sorahaneworks/portal_/home",
      elements: {},
    },
    "Studio Web のプロジェクト": {
      url: "https://cloud.uipath.com/sorahaneworks/studio_/projects",
      elements: {
        // 行の data-cy に、ソリューションの名前が入る（言語によらない）
        "IrAppCheck のソリューション": (p) => p.locator('[data-cy="grid-project-info-IrAppCheckSolution"]'),
      },
    },
  },
});
