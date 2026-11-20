// Studio Web の Cloud Workspace で、ソリューションの .uis を Import し、一覧に出るのを確かめる（AUT-1214 の作る題材 B。利用者の了承済み 2026-11-20）。
// 作るもの：ソリューション ircu-importSolution（.uis は IrAppCheck.uis の名前と SolutionId を変えたもの）。
// 消すのは後始末の cleanup.ts（uip solution delete）。
// Playwright ではファイルの選択を setInputFiles で入れる（隠れた input[type=file]、accept=.uip,.uis）。
// 使い方（リポジトリの根元で）: node samples/pw/import/import.ts <.uis のパス>
import { join } from "node:path";
import { launch } from "../../../tools/pw/runtime.ts";

export const NAME = "ircu-importSolution";
const uis = process.argv[2];
if (!uis) { console.error("使い方: node samples/pw/import/import.ts <.uis のパス>"); process.exit(2); }
const userDataDir = process.env.PW_USER_DATA_DIR ?? join(process.env.LOCALAPPDATA ?? "", "UiPath", "IrCloudUiChrome-pw");
const { browser, page } = await launch("ja-JP", { userDataDir });
let code = 0;
try {
  await page.goto("https://cloud.uipath.com/sorahaneworks/portal_/home"); await page.waitForTimeout(4000);
  await page.goto("https://cloud.uipath.com/sorahaneworks/studio_/projects");
  await page.locator('[data-cy^="grid-project-info-"]').first().waitFor({ timeout: 60000 });
  if (await page.locator(`[data-cy="grid-project-info-${NAME}"]`).count()) throw new Error(`${NAME} がもうある（前の回の残り）。後始末で消してから流す`);
  await page.locator("[data-cy=menu-project-open-menu]").click();
  await page.locator("[data-cy=menu-project-option-import-project]").click();
  await page.locator("input[type=file][accept*='.uis']").setInputFiles(uis);
  console.log(`取り込みを始めた: ${uis}`);
  // 取り込むと、デザイナーが開くか、一覧に戻る。一覧で待つ
  await page.waitForTimeout(8000);
  console.log("取り込んだあとの URL:", page.url());
  await page.screenshot({ path: join(process.env.TEMP ?? ".", "import-after.png") });
  if (!page.url().includes("/studio_/projects")) await page.goto("https://cloud.uipath.com/sorahaneworks/studio_/projects");
  const row = page.locator(`[data-cy="grid-project-info-${NAME}"]`);
  await row.waitFor({ timeout: 90000 });
  console.log(`取り込んだソリューション: ${NAME}`);
} catch (e) {
  console.log(`取り込めなかった: ${(e as Error).message.split("\n")[0]}`);
  code = 1;
} finally {
  await browser.close();
}
process.exit(code);
