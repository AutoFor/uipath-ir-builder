// Agents のメモリ空間を Shared に作り、一覧に出るのを確かめる（AUT-1214 の作る題材 A。利用者の了承済み 2026-11-20）。
// 作るもの：メモリ空間 1 つ（ircu-memory-check、フォルダ Shared）。消すのは後始末の cleanup.ts（記録しない。ロボットでは消せない理由はそちら）。
// この台本は記録のあとに cleanup.ts を呼んで消す。ロボット（PwMemory）で流したあとは、tm-run.mjs の suite の cleanup が呼ぶ。
// サインイン済みの専用のプロファイル（%LOCALAPPDATA%\UiPath\IrCloudUiChrome）を記録に書く。ほかの Chrome がそのプロファイルを開いていると使えない。
// 使い方（リポジトリの根元で）: node samples/pw/memory/memory.ts <ロケール> [<記録の出力先>]
import { spawnSync } from "node:child_process";
import { join } from "node:path";
import { launch, UiRecorder } from "../../../tools/pw/recorder.ts";
import objects, { NAME } from "./objects.ts";

const locale = process.argv[2] ?? "ja-JP";
const output = process.argv[3] ?? `samples/pw/memory/rec/memory.${locale.slice(0, 2)}.json`;
const userDataDir = join(process.env.LOCALAPPDATA ?? "", "UiPath", "IrCloudUiChrome");
// Playwright が開くのは PW_USER_DATA_DIR（プロフィールの写し）があればそちら。記録（UiPath で開くプロフィール）は userDataDir のまま。
// 同じプロフィールを Playwright で使った直後は、ロボットの Chrome が「ブラウザーを起動できませんでした」になった（2026-11-20）
const { browser, page } = await launch(locale, { userDataDir: process.env.PW_USER_DATA_DIR ?? userDataDir });
let created = "";
try {
  const C = objects(page, locale).UiPath_Cloud;
  const A = C.メモリ空間の作成;
  const M = C.メモリ空間;
  const rec = new UiRecorder(page, locale, { userDataDir });
  await rec.goto(C.ポータル);
  // 作る
  await rec.goto(A);
  await rec.fill(A.名前の欄, NAME, { valueArg: "in_Name" });
  await rec.fill(A.説明の欄, "IRCU のテスト用（AUT-1214）。後始末で消す");
  await rec.click(A.フォルダーの欄);
  await rec.click(A.Shared_の選択肢);
  await rec.click(A.保存);
  // 一覧に出るのを確かめる（保存すると一覧に戻る）
  await rec.waitVisible(M.作ったメモリ空間, 60000);
  created = await rec.text(M.作ったメモリ空間, "out_Created");
  rec.save(output);
  console.log(`記録した: ${output}（作った: ${created}）`);
} finally {
  await browser.close();
}
// 後始末（記録しない）
const c = spawnSync(process.execPath, [join(import.meta.dirname, "cleanup.ts")], { stdio: "inherit", env: process.env });
process.exit(c.status ?? 1);
