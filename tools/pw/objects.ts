// Playwright 側のオブジェクトリポジトリ（AUT-1219）。UiPath の .objects と同じく、セレクターはコードの外に置き、名前で指す。
//
//   const O = objects(page, "ja-JP");
//   await O.IR_Form.フォーム.名前.fill("太郎");      // O.アプリ.画面.要素（それぞれ Locator）
//   await page.goto(O.IR_Form.フォーム.$url);
//
// - 階層は UiPath と同じ：アプリ → 画面 → 要素。名前の空白などは _ にする（Coded の Descriptors と同じ。"IR Form" → IR_Form）
// - 要素は、ロケールごとの locator を持てる（{ "ja-JP": …, "en-US": …, "*": … }）。objects(page, locale) のロケールで選ぶ
//   （同じロケール → 同じ言語（ja）→ "*" → 先頭の順）
// - <P>/pw/objects/index.ts は pw-objects.ts が ir/repository.json から作る（正本は repository.json）。
//   記録の台本（samples/pw/*）では、記録の前に手で書く（記録すると、その名前のまま repository.json に入る）
// - pw-objects.ts が <P>/pw/lib/ に写す。ほかのファイルを import しない
import type { Locator, Page } from "playwright-core";

export type LocatorFn = (p: Page) => Locator;
export type ElementDef = LocatorFn | Record<string, LocatorFn>;
export type ScreenDef = { url?: string; urlPattern?: string; elements: Record<string, ElementDef> };
export type ObjectsDef = Record<string, Record<string, ScreenDef>>;
export type ElementMeta = { app: string; screen: string; name: string };
export type ScreenInfo = { $app: string; $name: string; $url?: string; $urlPattern?: string };
export type Screen = ScreenInfo & Record<string, Locator>;
export type Objects = Record<string, Record<string, Screen>>;

const META = Symbol.for("uipath-ir-builder.pw.element");

// 名前を JavaScript の名前にする（Descriptors と同じく、使えない文字は _）
export function ident(name: string): string {
  let s = name.replace(/[^\p{L}\p{N}_$]/gu, "_");
  if (/^\p{N}/u.test(s)) s = "_" + s;
  return s;
}

// locator に付けた名前（アプリ・画面・要素）。記録の道具が読む
export function metaOf(target: Locator): ElementMeta | undefined {
  return (target as unknown as Record<symbol, ElementMeta | undefined>)[META];
}

export function pickLocale<T>(byLocale: Record<string, T>, locale: string): T | undefined {
  if (locale in byLocale) return byLocale[locale];
  const lang = locale.split("-")[0];
  const same = Object.keys(byLocale).find((k) => k !== "*" && k.split("-")[0] === lang);
  if (same) return byLocale[same];
  return byLocale["*"] ?? Object.values(byLocale)[0];
}

export function defineObjects(def: ObjectsDef): (page: Page, locale?: string) => Objects {
  // 名前がぶつからないか、先に確かめる
  for (const [app, screens] of Object.entries(def)) {
    const seen = new Map<string, string>();
    for (const [screen, s] of Object.entries(screens)) {
      for (const k of [screen, ...Object.keys(s.elements).map((e) => `${screen}/${e}`)]) {
        const id = k.split("/").map(ident).join("/");
        if (seen.has(id)) throw new Error(`オブジェクトの名前がぶつかる（${app}：${seen.get(id)} と ${k}）`);
        seen.set(id, k);
      }
    }
  }
  return (page: Page, locale = "*") => {
    const tree: Objects = {};
    for (const [app, screens] of Object.entries(def)) {
      const a: Record<string, Screen> = (tree[ident(app)] = {});
      for (const [screen, s] of Object.entries(screens)) {
        const sc = { $app: app, $name: screen, $url: s.url, $urlPattern: s.urlPattern } as Screen;
        for (const [name, e] of Object.entries(s.elements)) {
          Object.defineProperty(sc, ident(name), {
            enumerable: true,
            get: () => {
              const fn = typeof e === "function" ? e : pickLocale(e, locale);
              if (!fn) throw new Error(`${app}/${screen}/${name} に ${locale} の locator が無い`);
              const l = fn(page);
              (l as unknown as Record<symbol, ElementMeta>)[META] = { app, screen, name };
              return l;
            },
          });
        }
        a[ident(screen)] = sc;
      }
    }
    return tree;
  };
}
