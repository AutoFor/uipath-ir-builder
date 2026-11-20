// Studio Web の Cloud Workspace を開き、ソリューション IrAppCheckSolution が一覧に出ることを確かめる（AUT-1214 の題材。読むだけ）。
// サインイン済みの専用のプロファイル（%LOCALAPPDATA%\UiPath\IrCloudUiChrome）で開く。
// 使い方（リポジトリの根元で）: node samples/pw/studioweb/studioweb.ts <ロケール> [<記録の出力先>]
import { join } from "node:path";
import { launch, UiRecorder } from "../../../tools/pw/recorder.ts";
import objects from "./objects.ts";

const locale = process.argv[2] ?? "ja-JP";
const output = process.argv[3] ?? `samples/pw/studioweb/rec/studioweb.${locale.slice(0, 2)}.json`;
const userDataDir = join(process.env.LOCALAPPDATA ?? "", "UiPath", "IrCloudUiChrome");
// Playwright が開くのは PW_USER_DATA_DIR（プロフィールの写し）があればそちら。記録（UiPath で開くプロフィール）は userDataDir のまま。
// 同じプロフィールを Playwright で使った直後は、ロボットの Chrome が「ブラウザーを起動できませんでした」になった（2026-11-20）
const { browser, page } = await launch(locale, { userDataDir: process.env.PW_USER_DATA_DIR ?? userDataDir });
try {
  const C = objects(page, locale).UiPath_Cloud;
  const S = C.Studio_Web_のプロジェクト;
  const rec = new UiRecorder(page, locale, { userDataDir });
  await rec.goto(C.ポータル);
  await rec.goto(S);
  await rec.waitVisible(S.IrAppCheck_のソリューション, 60000);
  const name = await rec.text(S.IrAppCheck_のソリューション, "out_Solution");
  rec.save(output);
  console.log(`記録した: ${output}（${name}）`);
} finally {
  await browser.close();
}
