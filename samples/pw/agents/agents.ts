// Agents（agents_）のテンプレートの一覧を開き、テンプレートが出ることを確かめる（AUT-1214 の題材。読むだけ）。
// サインイン済みの専用のプロファイル（%LOCALAPPDATA%\UiPath\IrCloudUiChrome）で開く。
// 使い方（リポジトリの根元で）: node samples/pw/agents/agents.ts <ロケール> [<記録の出力先>]
import { join } from "node:path";
import { launch, UiRecorder } from "../../../tools/pw/recorder.ts";
import objects from "./objects.ts";

const locale = process.argv[2] ?? "ja-JP";
const output = process.argv[3] ?? `samples/pw/agents/rec/agents.${locale.slice(0, 2)}.json`;
const userDataDir = join(process.env.LOCALAPPDATA ?? "", "UiPath", "IrCloudUiChrome");
const { browser, page } = await launch(locale, { userDataDir });
try {
  const C = objects(page, locale).UiPath_Cloud;
  const T = C.Agents_のテンプレート;
  const rec = new UiRecorder(page, locale, { userDataDir });
  await rec.goto(C.ポータル);
  await rec.goto(T);
  // 表（grid-container）は shadow DOM の中で、UiPath では見つからないので使わない。カード（shadow DOM の外）で待つ
  await rec.waitVisible(T.言語判定のテンプレート, 60000);
  const name = await rec.text(T.言語判定のテンプレート, "out_Template");
  rec.save(output);
  console.log(`記録した: ${output}（${name}）`);
} finally {
  await browser.close();
}
