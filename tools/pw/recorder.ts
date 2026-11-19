// Playwright（TypeScript）で画面を操作しながら、操作した要素の属性を記録する（AUT-1219）。
// 記録（JSON）は record-to-ir.ts で IR と <P>/ir/repository.json にする。
//
// 使い方（スクリプトから import する。playwright-core は tools/pw にだけ入れてある: cd tools/pw && npm install）:
//   import { UiRecorder, launch } from "../../../tools/pw/recorder.ts";
//   const { browser, page } = await launch("ja-JP");
//   const rec = new UiRecorder(page, "ja-JP");
//   await rec.goto("Studio Web", "https://cloud.uipath.com/...", { urlArg: "in_Url" });
//   await rec.click("Studio Web", "Run ボタン", page.locator("[data-cy=run-btn]"));
//   await rec.fill("アプリ", "入力欄", page.getByRole("textbox"), "ir", { valueArg: "in_Text" });
//   const t = await rec.text("アプリ", "ラベル", page.locator("mat-label"), "out_Label");
//   rec.save("rec/x.ja.json");
//
// - 画面の名前（screen）と要素の名前（name）は、オブジェクトリポジトリの画面と要素の名前になる
// - 日本語と英語の画面で、同じスクリプトを 1 回ずつ流す（launch のロケール）。record-to-ir.ts は 2 つの記録を手順の順番で突き合わせる
// - Playwright にしか無い操作（page.route、page.evaluate など）を使ったら、unsupported で記録に残す。
//   変換できないものとして一覧に出る（黙って捨てない）
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { chromium, type Browser, type Locator, type Page } from "playwright-core";
import type { Recording, Snapshot, Step } from "./record-to-ir.ts";

// ロボットと同じ Chrome（channel: chrome）で開く。Playwright 用のブラウザーは落とさない
export async function launch(locale: string, opt: { headless?: boolean; channel?: string } = {}): Promise<{ browser: Browser; page: Page }> {
  const browser = await chromium.launch({ channel: opt.channel ?? "chrome", headless: opt.headless ?? true });
  const ctx = await browser.newContext({ locale });
  return { browser, page: await ctx.newPage() };
}

// 要素の属性・テキスト・CSS のパス・祖先・候補ごとの一致数を取る（ブラウザーの中で動く）
export function snapshotInPage(el: Element): Snapshot {
  const attrs: Record<string, string> = {};
  for (const a of Array.from(el.attributes)) attrs[a.name] = a.value;
  const norm = (s: string | null | undefined) => (s || "").trim().replace(/\s+/g, " ");
  const textOf = (e: Element) => norm((e as HTMLElement).innerText ?? e.textContent).slice(0, 200);
  const text = textOf(el);
  const cssPath = (e: Element | null) => {
    const p: string[] = [];
    while (e && e.nodeType === 1 && e !== document.documentElement) {
      let s = e.tagName.toLowerCase();
      if (e.id) { p.unshift(s + "#" + CSS.escape(e.id)); break; }
      const parent: Element | null = e.parentElement;
      if (parent) {
        const sib = Array.from(parent.children).filter((c) => c.tagName === e!.tagName);
        if (sib.length > 1) s += ":nth-of-type(" + (sib.indexOf(e) + 1) + ")";
      }
      p.unshift(s);
      e = parent;
    }
    return p.join(" > ");
  };
  const ancestors: Record<string, string>[] = [];
  let a = el.parentElement;
  for (let i = 0; a && i < 4; i++, a = a.parentElement) {
    const x: Record<string, string> = { tag: a.tagName };
    for (const n of ["id", "data-testid", "data-cy", "data-e2e", "data-test", "role", "aria-label"]) { const v = a.getAttribute(n); if (v) x[n] = v; }
    ancestors.push(x);
  }
  const root = el.getRootNode() as Document | ShadowRoot;
  const q = (sel: string) => { try { return root.querySelectorAll(sel).length; } catch { return -1; } };
  const tag = el.tagName.toLowerCase();
  const quote = (v: string) => '"' + v.replace(/\\/g, "\\\\").replace(/"/g, '\\"') + '"';
  const counts: Record<string, number> = {};
  for (const [k, v] of Object.entries(attrs)) {
    if (k === "style" || k === "class" || v.length > 200) continue;
    counts[k] = q(tag + "[" + CSS.escape(k) + "=" + quote(v) + "]");
  }
  if (attrs["class"]) counts["class"] = q(tag + "[class=" + quote(attrs["class"]) + "]");
  counts["#text"] = text ? Array.from(root.querySelectorAll(tag)).filter((x) => textOf(x) === text).length : -1;
  counts["#tag"] = q(tag);
  return {
    tag: el.tagName, attrs, text, value: "value" in el ? String((el as HTMLInputElement).value ?? "") : null,
    role: el.getAttribute("role"), css: cssPath(el), ancestors, counts,
    inShadow: root instanceof ShadowRoot, inFrame: window !== window.top,
  };
}

type StepOpts = { urlArg?: string; valueArg?: string };

export class UiRecorder {
  readonly steps: Step[] = [];
  private readonly page: Page;
  private readonly locale: string;
  constructor(page: Page, locale: string) {
    this.page = page;
    this.locale = locale;
  }

  async goto(screen: string, url: string, opt: StepOpts = {}) {
    await this.page.goto(url);
    const step = await this.newStep("goto", screen);
    step.url = url;
    if (opt.urlArg) step.urlArg = opt.urlArg;
  }

  async click(screen: string, name: string, target: Locator) {
    await target.waitFor({ state: "visible" });
    const step = await this.newStep("click", screen, name, target);
    await target.click();
    step.urlAfter = this.page.url();
  }

  async fill(screen: string, name: string, target: Locator, value: string, opt: StepOpts = {}) {
    await target.waitFor({ state: "visible" });
    const step = await this.newStep("fill", screen, name, target);
    step.value = value;
    if (opt.valueArg) step.valueArg = opt.valueArg;
    await target.fill(value);
  }

  async text(screen: string, name: string, target: Locator, outVar: string): Promise<string> {
    await target.waitFor({ state: "visible" });
    const step = await this.newStep("text", screen, name, target);
    const text = (await target.innerText()).trim();
    step.outVar = outVar;
    step.result = text;
    return text;
  }

  // 要素が出るまで待つ（UiPath では Check State の「出るまで待つ」）
  async waitVisible(screen: string, name: string, target: Locator, timeoutMs = 30000) {
    await target.waitFor({ state: "visible", timeout: timeoutMs });
    const step = await this.newStep("wait", screen, name, target);
    step.timeoutMs = timeoutMs;
  }

  // 出たときだけ押す（Cookie のバナーを閉じるなど）。UiPath では Check State（出なくても止めない）＋ If ＋ Click
  async clickIfVisible(screen: string, name: string, target: Locator, timeoutMs = 5000): Promise<boolean> {
    let appeared = true;
    try { await target.first().waitFor({ state: "visible", timeout: timeoutMs }); } catch (e) { if ((e as Error).name !== "TimeoutError") throw e; appeared = false; }
    const step = await this.newStep("clickIf", screen, name, appeared ? target : undefined);
    step.timeoutMs = timeoutMs;
    step.appeared = appeared;
    if (appeared) await target.first().click();
    return appeared;
  }

  // Playwright にしか無い操作を使ったことを残す（変換できないものの一覧に出る）
  unsupported(what: string, detail: string) {
    this.steps.push({ i: this.steps.length, action: "unsupported", what, detail });
  }

  recording(): Recording {
    const browser = this.page.context().browser();
    return { version: 1, locale: this.locale, browser: browser?.browserType().name(), browserVersion: browser?.version(), recordedAt: new Date().toISOString(), steps: this.steps };
  }

  save(path: string) {
    mkdirSync(dirname(resolve(path)), { recursive: true });
    writeFileSync(path, JSON.stringify(this.recording(), null, 2) + "\n");
  }

  private async newStep(action: Step["action"], screen: string, name?: string, target?: Locator): Promise<Step> {
    const step: Step = {
      i: this.steps.length, action, screen,
      page: { url: this.page.url(), title: await this.page.title(), lang: await this.page.evaluate(() => document.documentElement.lang || "") },
    };
    if (name !== undefined) step.name = name;
    if (target) {
      const count = await target.count();
      step.element = { ...(await target.first().evaluate(snapshotInPage)), locatorCount: count };
    }
    this.steps.push(step);
    return step;
  }
}
