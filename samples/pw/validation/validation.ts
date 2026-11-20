// Action Center の Validation Station で、書類の確認のタスクを「送信」する（AUT-1214 の作る題材 D。利用者の了承済み 2026-11-20）。
// タスクは、テスト用のエージェント ircu-validation を uip agent debug で流して作り、uip tasks assign で Trial のアカウントに割り当てたもの。
// 送信は戻せない（完了したタスクは残る）。
// Playwright だけで流す題材：Validation Station は UI-DU-VALIDATION-STATION-WC-ELEMENT の shadow DOM の中にあり、
//   UiPath の webctrl のセレクターでは見つからない（2026-11-20、DESKTOP。shadow DOM の中の要素は属性で指しても見つからなかった）。
// 使い方（リポジトリの根元で）: node samples/pw/validation/validation.ts <タスクの Id>
import { join } from "node:path";
import { launch } from "../../../tools/pw/runtime.ts";

const taskId = process.argv[2];
if (!/^\d+$/.test(taskId ?? "")) { console.error("使い方: node samples/pw/validation/validation.ts <タスクの Id>"); process.exit(2); }
const userDataDir = process.env.PW_USER_DATA_DIR ?? join(process.env.LOCALAPPDATA ?? "", "UiPath", "IrCloudUiChrome-pw");
const { browser, page } = await launch("ja-JP", { userDataDir });
let code = 0;
try {
  await page.goto("https://cloud.uipath.com/sorahaneworks/portal_/home"); await page.waitForTimeout(4000);
  await page.goto(`https://cloud.uipath.com/sorahaneworks/DefaultTenant/actions_/tasks/${taskId}`);
  // 送信ボタン（shadow DOM の中。Playwright の CSS・role は shadow DOM の中まで探す）
  const submit = page.getByRole("button", { name: /^(送信|Submit)$/ });
  await submit.waitFor({ timeout: 90000 });
  // 抽出結果が読み込まれてから押す
  await page.getByText(/12000|INV-001/).first().waitFor({ timeout: 60000 }).catch(() => {});
  await page.waitForTimeout(3000);
  await submit.click();
  console.log(`送信を押した: タスク ${taskId}`);
  // 確定していないフィールドがあると、ボタンの左に「n 個のフィールドが自動的に確定されます。続行しますか？」と出る（画面ではなく、同じ場所に出る）
  await page.waitForTimeout(3000);
  const proceed = page.getByRole("button", { name: /^(続行して保存|Continue and save)/ });
  if (await proceed.count()) {
    await proceed.first().click();
    console.log("自動で確定するフィールドを、続行して保存した");
  }
  // 確かめの画面が出たら、その中の送信・確定を押す
  await page.waitForTimeout(3000);
  const dialog = page.getByRole("dialog").filter({ visible: true });
  if (await dialog.count()) {
    const texts = (await dialog.last().innerText()).replace(/\s+/g, " ").slice(0, 200);
    console.log(`確かめの画面: ${texts}`);
    await dialog.last().getByRole("button", { name: /^(送信|Submit|はい|Yes|確認|OK)$/ }).first().click();
  }
  await page.waitForTimeout(8000);
  await page.screenshot({ path: join(process.env.TEMP ?? ".", "validation-submitted.png") });
} catch (e) {
  console.log(`送信できなかった: ${(e as Error).message.split("\n")[0]}`);
  code = 1;
} finally {
  await browser.close();
}
process.exit(code);
