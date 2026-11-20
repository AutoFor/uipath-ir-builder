// 後始末：memory.ts（ロボットでは PwMemory）が作ったメモリ空間 ircu-memory-check を消し、一覧から消えたことを確かめる（AUT-1214 の作る題材 A）。
// ロボットで消さない理由：削除の確かめの欄（AP-ALERT-POPUP の中の入力欄）は shadow DOM の中にあり、
//   UiPath の Type Into は既定の入力方式（ChromiumAPI）では外側の部品に打っても中の欄に届かない。WindowMessages は Web では使えない。
//   実際のキー入力（HardwareEvents）は、RDP の窓が手元で前に出ていないと止まる（2026-11-20、DESKTOP で 2 回 15 分止まった）。
// 無ければ何もしない（終了コード 0）。消せなければ 1。
// 使い方（リポジトリの根元で）: node samples/pw/memory/cleanup.ts
import { join } from "node:path";
import { launch } from "../../../tools/pw/recorder.ts";
import objects, { NAME } from "./objects.ts";

const userDataDir = process.env.PW_USER_DATA_DIR ?? join(process.env.LOCALAPPDATA ?? "", "UiPath", "IrCloudUiChrome-pw");
const { browser, page } = await launch("ja-JP", { userDataDir });
let code = 0;
try {
  const M = objects(page, "ja-JP").UiPath_Cloud.メモリ空間;
  await page.goto("https://cloud.uipath.com/sorahaneworks/portal_/home"); await page.waitForTimeout(4000);
  await page.goto(M.$url!);
  await page.locator('[slot^="cell__slot__name"]').first().waitFor({ timeout: 60000 });
  await page.waitForTimeout(2000);
  if (!(await M.作ったメモリ空間.count())) console.log(`後始末: ${NAME} は無い（消すものなし）`);
  else {
    // 名前の行にいちばん近い削除ボタン（行の高さで選ぶ）
    const box = (await M.作ったメモリ空間.first().boundingBox())!;
    const y = box.y + box.height / 2;
    const idx = await M.行の削除.evaluateAll((els, yy) => { let b = -1, d = 1e9; els.forEach((e, i) => { const r = e.getBoundingClientRect(); const dd = Math.abs(r.y + r.height / 2 - yy); if (dd < d) { d = dd; b = i; } }); return b; }, y);
    await M.行の削除.nth(idx).click();
    await M.削除の確定.waitFor();
    // 消す前に、確かめの画面が作ったものの名前を求めていることを確かめる（ほかの行を消さない）
    const asked = await M.削除の確定.getAttribute("placeholder");
    if (asked !== NAME) throw new Error(`確かめの画面の名前が違う（${asked}）。押さずに止める`);
    await M.削除の確定.click();
    await page.keyboard.type(NAME);
    for (const k of ["Tab", "Tab", "Enter"]) { await page.waitForTimeout(300); await page.keyboard.press(k); }
    await M.削除の確定.waitFor({ state: "hidden", timeout: 30000 });
    // 消したあと、一覧に反映されるまで少しかかる（すぐに読み直すと、まだ出ていた）。3 回まで読み直す
    let still = true;
    for (let k = 0; k < 3 && still; k++) {
      await page.waitForTimeout(5000);
      await page.reload();
      await page.locator('[slot^="cell__slot__name"]').first().waitFor({ timeout: 60000 });
      await page.waitForTimeout(2000);
      still = (await M.作ったメモリ空間.count()) > 0;
    }
    if (still) { console.log(`後始末: ${NAME} が消えない`); code = 1; }
    else console.log(`後始末: ${NAME} を消した`);
  }
} catch (e) {
  console.log(`後始末: 失敗（${(e as Error).message.split("\n")[0]}）`);
  code = 1;
} finally {
  await browser.close();
}
process.exit(code);
