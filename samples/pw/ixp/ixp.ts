// IXP のプロジェクトの一覧を開き、プロジェクトが出ることを確かめる（AUT-1214 の題材。読むだけで、何も作らない・変えない）。
// サインイン済みの専用のプロファイル（%LOCALAPPDATA%\UiPath\IrCloudUiChrome）で開く。ほかの Chrome がそのプロファイルを開いていると使えない。
// 使い方（リポジトリの根元で）: node samples/pw/ixp/ixp.ts <ロケール> [<記録の出力先>]
import { join } from "node:path";
import { launch, UiRecorder } from "../../../tools/pw/recorder.ts";
import objects from "./objects.ts";

const locale = process.argv[2] ?? "ja-JP";
const output = process.argv[3] ?? `samples/pw/ixp/rec/ixp.${locale.slice(0, 2)}.json`;
const userDataDir = join(process.env.LOCALAPPDATA ?? "", "UiPath", "IrCloudUiChrome");
const { browser, page } = await launch(locale, { userDataDir });
try {
  const C = objects(page, locale).UiPath_Cloud;
  const rec = new UiRecorder(page, locale, { userDataDir });
  // ポータルを先に開く（IXP を直接開くと、サインインの画面に戻されることがある）
  await rec.goto(C.ポータル);
  // IXP の入口。IXP の中のサインイン（oauth2）を通って、プロジェクトの一覧に転送される
  await rec.goto(C.IXP_プロジェクト);
  await rec.waitVisible(C.IXP_プロジェクト.プロジェクトの表, 60000);
  await rec.waitVisible(C.IXP_プロジェクト.請求書のプロジェクト, 30000);
  const name = await rec.text(C.IXP_プロジェクト.請求書のプロジェクト, "out_Project");
  rec.save(output);
  console.log(`記録した: ${output}（${name}）`);
} finally {
  await browser.close();
}
