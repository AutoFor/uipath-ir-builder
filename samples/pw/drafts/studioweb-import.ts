// 下書き（まだ流していない。利用者の了承が出るまで流さない）：Studio Web にソリューション（.uis）を取り込み、一覧に出るのを確かめる（AUT-1214）。
// 作るもの：ソリューション 1 つ。あとで uip solution delete <Id> --yes で消す。
// セレクターは仮。画面の DOM を見てから objects に書き直す
import { join } from "node:path";
import { defineObjects } from "../../../tools/pw/objects.ts";
import { launch, UiRecorder } from "../../../tools/pw/recorder.ts";

const objects = defineObjects({
  "UiPath Cloud": {
    "ポータル": { url: "https://cloud.uipath.com/sorahaneworks/portal_/home", elements: {} },
    "Studio Web のプロジェクト": {
      url: "https://cloud.uipath.com/sorahaneworks/studio_/projects",
      elements: {
        "新しく作る": (p) => p.getByRole("button", { name: /^(Create New|新規作成)/ }), // TODO
        "取り込む": (p) => p.getByRole("menuitem", { name: /^(Import|インポート)/ }),   // TODO
      },
    },
  },
});

const locale = process.argv[2] ?? "ja-JP";
const uisFile = process.argv[3] ?? "";   // 取り込む .uis（uip solution download で作ったもの）
const userDataDir = join(process.env.LOCALAPPDATA ?? "", "UiPath", "IrCloudUiChrome");
const { browser, page } = await launch(locale, { userDataDir, headless: false });
try {
  const C = objects(page, locale).UiPath_Cloud;
  const S = C.Studio_Web_のプロジェクト;
  const rec = new UiRecorder(page, locale, { userDataDir });
  await rec.goto(C.ポータル);
  await rec.goto(S);
  await rec.click(S.新しく作る);
  // TODO: ファイルの選択は Playwright の setInputFiles。UiPath では「ファイルを選ぶ」ダイアログの操作になり、変換できないものの一覧に出す（rec.unsupported）
  rec.unsupported("page.setInputFiles", `ファイルの選択（${uisFile}）。UiPath では Windows のファイルのダイアログの操作になる`);
  await rec.click(S.取り込む);
  // TODO: 取り込んだソリューションが一覧に出るのを待つ
  rec.save(`samples/pw/drafts/rec/studioweb-import.${locale.slice(0, 2)}.json`);
} finally {
  await browser.close();
}
