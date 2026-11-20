// 下書き（まだ流していない。利用者の了承が出るまで流さない）：Agents のメモリスペースを作り、一覧に出るのを確かめ、消す（AUT-1214）。
// 作るもの：メモリスペース 1 つ（名前 ircu-memory-<日時>、フォルダ Shared）。同じ台本の最後で消す。
// セレクターは仮。画面の DOM を見てから objects に書き直す
import { join } from "node:path";
import { defineObjects } from "../../../tools/pw/objects.ts";
import { launch, UiRecorder } from "../../../tools/pw/recorder.ts";

const objects = defineObjects({
  "UiPath Cloud": {
    "ポータル": { url: "https://cloud.uipath.com/sorahaneworks/portal_/home", elements: {} },
    "メモリスペース": {
      url: "https://cloud.uipath.com/sorahaneworks/agents_/memory",   // TODO: 本当の URL を確かめる
      elements: {
        "作るボタン": (p) => p.getByRole("button", { name: /^(Create|作成)/ }),                 // TODO
        "名前の欄": (p) => p.getByLabel(/^(Name|名前)/),                                       // TODO
        "保存": (p) => p.getByRole("button", { name: /^(Create|Save|作成|保存)$/ }).last(),   // TODO
        "消すボタン": (p) => p.getByRole("button", { name: /^(Delete|削除)$/ }),                 // TODO
        "確かめの欄": (p) => p.getByRole("textbox").last(),                                    // TODO
      },
    },
  },
});

const locale = process.argv[2] ?? "ja-JP";
const name = `ircu-memory-${new Date().toISOString().slice(0, 16).replace(/[-:T]/g, "")}`;
const userDataDir = join(process.env.LOCALAPPDATA ?? "", "UiPath", "IrCloudUiChrome");
const { browser, page } = await launch(locale, { userDataDir, headless: false });
try {
  const C = objects(page, locale).UiPath_Cloud;
  const M = C.メモリスペース;
  const rec = new UiRecorder(page, locale, { userDataDir });
  await rec.goto(C.ポータル);
  await rec.goto(M);
  await rec.click(M.作るボタン);
  await rec.fill(M.名前の欄, name, { valueArg: "in_Name" });
  await rec.click(M.保存);
  // TODO: 一覧に name が出るのを待つ（要素は名前で 1 つに決める）
  // TODO: 消す：行のメニュー → Delete → 名前を打つ → Delete
  rec.save(`samples/pw/drafts/rec/memory-space.${locale.slice(0, 2)}.json`);
} finally {
  await browser.close();
}
