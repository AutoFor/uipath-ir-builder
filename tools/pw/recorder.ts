// Playwright（TypeScript）で画面を操作しながら、操作した要素の属性を記録する（AUT-1219）。
// 記録（JSON）は record-to-ir.ts で IR と <P>/ir/repository.json にする。
//
// 使い方（スクリプトから import する。playwright-core は tools/pw にだけ入れてある: cd tools/pw && npm install）:
//   import { UiRecorder, launch } from "../../../tools/pw/recorder.ts";
//   import objects from "./objects.ts";                 // 要素は先に objects に定義する（tools/pw/objects.ts の defineObjects）
//   const { browser, page } = await launch("ja-JP");
//   const O = objects(page, "ja-JP");
//   const rec = new UiRecorder(page, "ja-JP");
//   await rec.goto(O.IR_Form.フォーム, { urlArg: "in_Url" });      // 画面の url を開く
//   await rec.fill(O.IR_Form.フォーム.名前, "ir", { valueArg: "in_Name" });
//   await rec.click(O.IR_Form.フォーム.送信);
//   const t = await rec.text(O.IR_Form.フォーム.結果, "out_Result");
//   rec.save("rec/x.ja.json");
//
// - アプリ・画面・要素の名前は、objects の名前のまま repository.json に入る（UiPath のオブジェクトリポジトリの名前）
// - セレクターをコードにじかに書く形（rec.click("画面", "名前", page.locator(...))）も使えるが、record-to-ir.ts が警告を出す
// - 日本語と英語の画面で、同じスクリプトを 1 回ずつ流す（launch のロケール）。record-to-ir.ts は 2 つの記録を手順の順番で突き合わせる
// - Playwright にしか無い操作（page.route、page.evaluate など）を使ったら、unsupported で記録に残す。
//   変換できないものとして一覧に出る（黙って捨てない）
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import type { Locator, Page } from "playwright-core";
import { metaOf, type Screen } from "./objects.ts";
import type { Recording, Snapshot, Step } from "./record-to-ir.ts";

export { launch } from "./runtime.ts";
export { defineObjects } from "./objects.ts";

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
  const root = el.getRootNode() as Document | ShadowRoot;
  const q = (sel: string) => { try { return root.querySelectorAll(sel).length; } catch { return -1; } };
  const tag = el.tagName.toLowerCase();
  const quote = (v: string) => '"' + v.replace(/\\/g, "\\\\").replace(/"/g, '\\"') + '"';
  // 祖先（親から 4 つ）。言語によらない属性（key）があれば、ページの中の数と、その中で同じタグ・同じ文字の要素の数も取る（複数行のセレクター）
  const ancestors: Record<string, string | number>[] = [];
  let a = el.parentElement;
  for (let i = 0; a && i < 4; i++, a = a.parentElement) {
    const x: Record<string, string | number> = { tag: a.tagName };
    for (const n of ["id", "data-testid", "data-cy", "data-e2e", "data-test", "data-qa", "role", "aria-label"]) { const v = a.getAttribute(n); if (v) x[n] = v; }
    const key = ["data-testid", "data-cy", "data-e2e", "data-test", "data-qa", "id"].find((n) => a!.getAttribute(n));
    if (key) {
      x.key = key;
      x.keyCount = q("[" + key + "=" + quote(a.getAttribute(key)!) + "]");
      x.innerTag = a.querySelectorAll(tag).length;
      x.innerText = text ? Array.from(a.querySelectorAll(tag)).filter((y) => textOf(y) === text).length : -1;
    }
    ancestors.push(x);
  }
  // 近くのラベル（アンカーの候補）：自分と親（2 つ上まで）の前の兄弟で、短い文字を持ち、入力欄やボタンを含まないもの
  let anchor: Record<string, unknown> | undefined;
  for (let cur: Element | null = el, up = 0; cur && up < 3 && !anchor; up++, cur = cur.parentElement) {
    for (let sib = cur.previousElementSibling; sib; sib = sib.previousElementSibling) {
      const t = textOf(sib);
      if (!t || t.length > 40 || sib.querySelector("input, textarea, select, button")) continue;
      const at = sib.tagName.toLowerCase();
      anchor = { tag: sib.tagName, text: t, textCount: Array.from(root.querySelectorAll(at)).filter((y) => textOf(y) === t).length };
      break;
    }
  }
  // iframe の中なら、その iframe（親の文書の中の要素）の属性と、親の文書の中の数
  let frame: Record<string, unknown> | undefined;
  try {
    const fe = window.frameElement;
    if (fe) {
      const fa: Record<string, string> = {}, fc: Record<string, number> = {};
      for (const n of ["id", "name", "title", "data-testid", "src"]) { const v = fe.getAttribute(n); if (v) fa[n] = v; }
      for (const [k, v] of Object.entries(fa)) fc[k] = fe.ownerDocument.querySelectorAll(fe.tagName.toLowerCase() + "[" + k + "=" + quote(v) + "]").length;
      frame = { tag: fe.tagName, attrs: fa, counts: fc };
    }
  } catch { /* 別のオリジンの iframe（frameElement を読めない） */ }
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
    inShadow: root instanceof ShadowRoot, inFrame: window !== window.top, anchor, frame,
    // 中の入力欄の値（参考）。UiPath の Get Text は、見えない入力欄（display:none でも）の値まで文字に入れる（Playwright の innerText は入れない）
    formValues: Array.from(el.querySelectorAll("input, textarea, select")).map((x) => (x as HTMLInputElement).value).filter((v) => v !== ""),
  };
}

type StepOpts = { urlArg?: string; valueArg?: string };
// 操作の相手：objects の要素（名前つきの Locator）か、じかに書いたもの（画面の名前・要素の名前・Locator）
type Target = { screen: string; name: string; app?: string; locator: Locator; direct: boolean };

function targetOf(a: Locator | string, b: unknown, c: unknown, what: string): { t: Target; rest: number } {
  if (typeof a === "string") {
    if (typeof b !== "string" || !c) throw new Error(`${what}：じかに書くときは (画面の名前, 要素の名前, locator, …) で渡す`);
    return { t: { screen: a, name: b, locator: c as Locator, direct: true }, rest: 3 };
  }
  const m = metaOf(a);
  if (!m) throw new Error(`${what}：objects で定義した要素（O.アプリ.画面.要素）を渡す。じかに書くなら (画面の名前, 要素の名前, locator)`);
  return { t: { screen: m.screen, name: m.name, app: m.app, locator: a, direct: false }, rest: 1 };
}

export class UiRecorder {
  readonly steps: Step[] = [];
  private readonly page: Page;
  private readonly locale: string;
  private readonly userDataDir?: string;
  // userDataDir：launch(locale, { userDataDir }) で開いたサインイン済みのプロファイル。UiPath でも同じプロファイル（UserDataFolderMode=CustomFolder）で開く
  constructor(page: Page, locale: string, opt: { userDataDir?: string } = {}) {
    this.page = page;
    this.locale = locale;
    this.userDataDir = opt.userDataDir;
  }

  // goto(O.アプリ.画面, { urlArg }) で画面の url を開く。goto("画面の名前", url, { urlArg }) とも書ける
  async goto(screen: Screen | string, a?: string | StepOpts, b?: StepOpts) {
    const byName = typeof screen === "string";
    const url = byName ? (a as string) : screen.$url;
    const opt = (byName ? b : (a as StepOpts | undefined)) ?? {};
    if (!url) throw new Error(`goto：${byName ? screen : screen.$name} の url が無い`);
    await this.page.goto(url);
    const step = await this.newStep("goto", byName ? { screen, name: "", locator: undefined as unknown as Locator, direct: false } : { screen: screen.$name, name: "", app: screen.$app, locator: undefined as unknown as Locator, direct: false });
    delete step.name;
    step.url = url;
    if (opt.urlArg) step.urlArg = opt.urlArg;
  }

  async click(a: Locator | string, b?: string, c?: Locator) {
    const { t } = targetOf(a, b, c, "click");
    await t.locator.waitFor({ state: "visible" });
    const step = await this.newStep("click", t, true);
    await t.locator.click();
    step.urlAfter = this.page.url();
  }

  async fill(a: Locator | string, ...r: unknown[]) {
    const { t, rest } = targetOf(a, r[0], r[1], "fill");
    const [value, opt = {}] = r.slice(rest - 1) as [string, StepOpts?];
    await t.locator.waitFor({ state: "visible" });
    const step = await this.newStep("fill", t, true);
    step.value = value;
    if (opt.valueArg) step.valueArg = opt.valueArg;
    await t.locator.fill(value);
  }

  async text(a: Locator | string, ...r: unknown[]): Promise<string> {
    const { t, rest } = targetOf(a, r[0], r[1], "text");
    const [outVar] = r.slice(rest - 1) as [string];
    await t.locator.waitFor({ state: "visible" });
    const step = await this.newStep("text", t, true);
    const text = (await t.locator.innerText()).trim();
    step.outVar = outVar;
    step.result = text;
    return text;
  }

  // 要素が出るまで待つ（UiPath では Check State の「出るまで待つ」）
  async waitVisible(a: Locator | string, ...r: unknown[]) {
    const { t, rest } = targetOf(a, r[0], r[1], "waitVisible");
    const [timeoutMs = 30000] = r.slice(rest - 1) as [number?];
    await t.locator.waitFor({ state: "visible", timeout: timeoutMs });
    const step = await this.newStep("wait", t, true);
    step.timeoutMs = timeoutMs;
  }

  // 出たときだけ押す（Cookie のバナーを閉じるなど）。UiPath では Check State（出なくても止めない）＋ If ＋ Click
  async clickIfVisible(a: Locator | string, ...r: unknown[]): Promise<boolean> {
    const { t, rest } = targetOf(a, r[0], r[1], "clickIfVisible");
    const [timeoutMs = 5000] = r.slice(rest - 1) as [number?];
    let appeared = true;
    try { await t.locator.first().waitFor({ state: "visible", timeout: timeoutMs }); } catch (e) { if ((e as Error).name !== "TimeoutError") throw e; appeared = false; }
    const step = await this.newStep("clickIf", t, appeared);
    step.timeoutMs = timeoutMs;
    step.appeared = appeared;
    if (appeared) await t.locator.first().click();
    return appeared;
  }

  // Playwright にしか無い操作を使ったことを残す（変換できないものの一覧に出る）
  unsupported(what: string, detail: string) {
    this.steps.push({ i: this.steps.length, action: "unsupported", what, detail });
  }

  recording(): Recording {
    const browser = this.page.context().browser();
    // incognito：Playwright の新しいコンテキストは、サインインなどが残らない（UiPath のシークレット ウィンドウと同じ意味）。
    // プロファイル（userDataDir）で開いたときは incognito ではない
    const r: Recording = { version: 1, locale: this.locale, browser: browser?.browserType().name() ?? "chromium", browserVersion: browser?.version(), incognito: !this.userDataDir, recordedAt: new Date().toISOString(), steps: this.steps };
    if (this.userDataDir) r.userDataDir = this.userDataDir;
    return r;
  }

  save(path: string) {
    mkdirSync(dirname(resolve(path)), { recursive: true });
    writeFileSync(path, JSON.stringify(this.recording(), null, 2) + "\n");
  }

  private async newStep(action: Step["action"], t: Target, snapshot = false): Promise<Step> {
    const step: Step = {
      i: this.steps.length, action, screen: t.screen,
      page: { url: this.page.url(), title: await this.page.title(), lang: await this.page.evaluate(() => document.documentElement.lang || "") },
    };
    if (t.app) step.app = t.app;
    if (t.name) step.name = t.name;
    if (t.direct) step.direct = true; // セレクターをコードにじかに書いた（record-to-ir.ts が警告を出す）
    if (snapshot && t.locator) {
      const count = await t.locator.count();
      step.element = { ...(await t.locator.first().evaluate(snapshotInPage)), locatorCount: count };
    }
    this.steps.push(step);
    return step;
  }
}
