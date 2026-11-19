// Playwright（TypeScript）のスクリプトが使う小道具（AUT-1219）。UiPath のアクティビティと同じ意味になるようにそろえる。
// pw-objects.ts が <P>/pw/lib/ に写す（生成したスクリプトは ./lib/runtime.ts で読む）。ほかのファイルを import しない。
import { chromium, type Browser, type Locator, type Page } from "playwright-core";

// ロボットと同じ Chrome（channel: chrome）で開く。Playwright 用のブラウザーは落とさない。
// コンテキストは毎回新しい（Cookie・サインインが残らない。UiPath の NApplicationCard の IsIncognito=True と同じ意味）
export async function launch(locale: string, opt: { headless?: boolean; channel?: string } = {}): Promise<{ browser: Browser; page: Page }> {
  const browser = await chromium.launch({ channel: opt.channel ?? "chrome", headless: opt.headless ?? true });
  const ctx = await browser.newContext({ locale });
  return { browser, page: await ctx.newPage() };
}

// Get Text：入力欄は値、それ以外は表示の文字（前後の空白は除く）
export async function getText(target: Locator): Promise<string> {
  const tag = await target.evaluate((e) => e.tagName);
  if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return await target.inputValue();
  return (await target.innerText()).trim();
}

// Get Attribute：UiPath の属性の名前で読む。innertext・visibleinnertext は Playwright の innerText（DESKTOP で、UiPath と同じ文字になった）。
// textContent は UiPath では空だった（DOM の属性ではないため）ので、ほかの属性と同じく getAttribute で読む（同じく空になる）
export async function getAttribute(target: Locator, name: string): Promise<string> {
  const n = name.toLowerCase();
  if (n === "innertext" || n === "visibleinnertext") return (await target.innerText()).trim();
  if (n === "value") return await target.inputValue();
  return (await target.getAttribute(name)) ?? "";
}

// Check State：時間内に出た（消えた）ら true、出なければ false（UiPath と同じく、時間切れは例外にしない）
export async function waitState(target: Locator, state: "visible" | "hidden", timeoutMs: number): Promise<boolean> {
  try {
    await target.waitFor({ state, timeout: timeoutMs });
    return true;
  } catch (e) {
    if ((e as Error).name === "TimeoutError") return false;
    throw e;
  }
}

// Log Message
export function log(level: "Trace" | "Info" | "Warn" | "Error" | "Fatal", message: unknown) {
  const text = `[${level}] ${String(message)}`;
  if (level === "Warn") console.warn(text);
  else if (level === "Error" || level === "Fatal") console.error(text);
  else console.log(text);
}
