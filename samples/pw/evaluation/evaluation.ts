// Studio Web から、テスト用のエージェント ircu-eval-agent の評価（Default Evaluation Set、2 件）を 1 回流す（AUT-1214 の作る題材 E。利用者の了承済み 2026-11-20）。
// 評価の実行の記録は残り、Agent Units / Platform Units を使う。了承は 1 回だけなので、何度も流さない。
// Playwright だけで流す題材：評価のタブ（data-tab-id=evaluations）も実行ボタンも shadow DOM の中にあり、
//   UiPath の webctrl のセレクターでは、属性で指しても見つからなかった（2026-11-20、DESKTOP。PwShadowProbe）。
// エージェントは tools/agent/gen.ts で作って uip solution upload で上げたもの（ircu-eval-agentSolution）。流したあと uip solution delete で消す。
// 使い方（リポジトリの根元で）: node samples/pw/evaluation/evaluation.ts <デザイナーの URL>
//   （uip solution upload の DesignerUrl）
import { join } from "node:path";
import { launch } from "../../../tools/pw/runtime.ts";

const url = process.argv[2];
if (!url) { console.error("使い方: node samples/pw/evaluation/evaluation.ts <デザイナーの URL>"); process.exit(2); }
const userDataDir = process.env.PW_USER_DATA_DIR ?? join(process.env.LOCALAPPDATA ?? "", "UiPath", "IrCloudUiChrome-pw");
const { browser, page } = await launch("ja-JP", { userDataDir });
let code = 0;
try {
  await page.goto("https://cloud.uipath.com/sorahaneworks/portal_/home"); await page.waitForTimeout(4000);
  await page.goto(url);
  const tab = page.locator('button[data-tab-id="evaluations"]');
  await tab.waitFor({ timeout: 60000 });
  await tab.click();
  await page.getByText("Default Evaluation Set", { exact: true }).waitFor();
  await page.getByText("Default Evaluation Set", { exact: true }).click();
  const run = page.getByTestId("evaluation-run-button");
  await run.waitFor();
  // セットを選んでから押せるようになるまで、少しかかる（最大 30 秒待つ）
  for (let i = 0; i < 30 && (await run.isDisabled()); i++) await page.waitForTimeout(1000);
  if (await run.isDisabled()) throw new Error("実行ボタンが押せない（評価のセットを選べていない）");
  const startedAt = new Date().toISOString();
  await run.click();
  console.log(`評価を流した: Default Evaluation Set（${startedAt}）`);
  await page.waitForTimeout(5000);
  await page.screenshot({ path: join(process.env.TEMP ?? ".", "evaluation-started.png") });
} catch (e) {
  console.log(`評価を流せなかった: ${(e as Error).message.split("\n")[0]}`);
  code = 1;
} finally {
  await browser.close();
}
process.exit(code);
