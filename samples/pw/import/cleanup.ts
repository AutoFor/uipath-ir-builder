// 後始末：import.ts（ロボットでは PwImport）が取り込んだソリューション ircu-importSolution を消し、一覧から消えたことを確かめる（AUT-1214 の作る題材 B）。
// ソリューションの Id は、一覧の行を開いたデザイナーの URL（solutionId=…）から読み、uip solution delete で消す（CLI に一覧のコマンドが無い）。
// 無ければ何もしない（終了コード 0）。消せなければ 1。
// 使い方（リポジトリの根元で）: node samples/pw/import/cleanup.ts
import { spawnSync } from "node:child_process";
import { join } from "node:path";
import { launch } from "../../../tools/pw/runtime.ts";

const NAME = "ircu-importSolution";
const userDataDir = process.env.PW_USER_DATA_DIR ?? join(process.env.LOCALAPPDATA ?? "", "UiPath", "IrCloudUiChrome-pw");
const uipJs = process.env.UIP_CLI_JS ?? join(process.env.APPDATA ?? "", "npm", "node_modules", "@uipath", "cli", "dist", "index.js");
const { browser, page } = await launch("ja-JP", { userDataDir });
const list = async () => {
  await page.goto("https://cloud.uipath.com/sorahaneworks/studio_/projects");
  await page.locator('[data-cy^="grid-project-info-"]').first().waitFor({ timeout: 60000 });
  await page.waitForTimeout(2000);
  return page.locator(`[data-cy="grid-project-info-${NAME}"]`);
};
let code = 0;
try {
  await page.goto("https://cloud.uipath.com/sorahaneworks/portal_/home"); await page.waitForTimeout(4000);
  let row = await list();
  if (!(await row.count())) console.log(`後始末: ${NAME} は無い（消すものなし）`);
  else {
    await row.click();
    await page.waitForURL(/solutionId=/, { timeout: 60000 });
    const id = new URL(page.url()).searchParams.get("solutionId");
    if (!id) throw new Error(`ソリューションの Id を読めない（${page.url()}）`);
    const r = spawnSync(process.execPath, [uipJs, "solution", "delete", id, "--yes", "--profile", "trial", "--output", "json"], { encoding: "utf8" });
    if (!/"Result":\s*"Success"/.test(r.stdout)) throw new Error(`uip solution delete ${id} が失敗: ${(r.stdout || r.stderr).slice(0, 200)}`);
    row = await list();
    if (await row.count()) { console.log(`後始末: ${NAME} が消えない（${id}）`); code = 1; }
    else console.log(`後始末: ${NAME} を消した（${id}）`);
  }
} catch (e) {
  console.log(`後始末: 失敗（${(e as Error).message.split("\n")[0]}）`);
  code = 1;
} finally {
  await browser.close();
}
process.exit(code);
