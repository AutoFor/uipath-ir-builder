// ir-to-pw.ts が作る Playwright（TypeScript）のスクリプトが使う小道具（AUT-1219）。
// UiPath のアクティビティと同じ意味になるようにそろえる。
import type { Locator } from "playwright-core";

export { launch } from "./recorder.ts";

// Get Text：入力欄は値、それ以外は表示の文字（前後の空白は除く）
export async function getText(target: Locator): Promise<string> {
  const tag = await target.evaluate((e) => e.tagName);
  if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return await target.inputValue();
  return (await target.innerText()).trim();
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
