import { strict as assert } from "node:assert";
import { test } from "node:test";
import { selectorToLocator } from "./selector.ts";

const ok = (sel: string) => { const r = selectorToLocator(sel); assert.ok("ts" in r, "why" in r ? r.why : ""); return r.ts; };
const ng = (sel: string) => { const r = selectorToLocator(sel); assert.ok("why" in r, `直せてしまった: ${sel}`); return r.why; };

test("属性は CSS の [属性=値]、タグは小文字", () => {
  assert.equal(ok("<webctrl tag='BUTTON' data-cy='run-btn' />"), 'page.locator("button[data-cy=\\"run-btn\\"]").first()');
  assert.equal(ok("<webctrl id='email' tag='INPUT' />"), 'page.locator("input[id=\\"email\\"]").first()');
  assert.equal(ok("<webctrl tag='A' href='https://x/*' />"), 'page.locator("a[href^=\\"https://x/\\"]").first()');
  assert.equal(ok("<webctrl aria-role='button' />"), 'page.locator("[role=\\"button\\"]").first()');
});

test("aria-label の正規表現は getByLabel、aaname は表示の文字（UiPath の aaname は表示の文字に当たる）", () => {
  assert.equal(ok("<webctrl tag='BUTTON' aria-label='^(閉じる|Close)$' matching:aria-label='regex' />"),
    'page.locator("button").and(page.getByLabel(new RegExp("^(閉じる|Close)$"))).first()');
  assert.equal(ok("<webctrl tag='BUTTON' aria-label='Run app' />"), 'page.locator("button[aria-label=\\"Run app\\"]").first()');
  assert.equal(ok("<webctrl tag='BUTTON' aaname='Run' />"), 'page.locator("button").filter({ hasText: new RegExp("^Run$") }).first()');
});

test("innertext は全体に合う正規表現。ワイルドカードも直す。&amp; などは戻す", () => {
  assert.equal(ok("<webctrl tag='SPAN' innertext='保存 &amp; 実行*' />"), 'page.locator("span").filter({ hasText: new RegExp("^保存 & 実行.*$") }).first()');
});

test("css-selector・parentid・idx・入れ子の webctrl・先頭の html", () => {
  assert.equal(ok("<webctrl css-selector='body > div:nth-of-type(2)' tag='DIV' />"), 'page.locator(":is(body > div:nth-of-type(2))").first()');
  assert.equal(ok("<webctrl parentid='box' tag='BUTTON' idx='2' />"), 'page.locator("[id=\\"box\\"] button").nth(1).first()');
  assert.equal(ok("<html app='chrome.exe' /><webctrl id='f' tag='FORM' /><webctrl tag='INPUT' name='q' />"),
    'page.locator("form[id=\\"f\\"]").locator("input[name=\\"q\\"]").first()');
});

test("直せないもの", () => {
  assert.match(ng("<wnd app='notepad.exe' /><ctrl role='editable text' />"), /Web の要素ではない/);
  assert.match(ng("<webctrl tag='DIV' aaname='Run' matching:aaname='fuzzy' />"), /あいまい一致/);
  assert.match(ng("<webctrl tag='DIV' id='a.*' matching:id='regex' />"), /正規表現/);
  assert.match(ng("<webctrl tag='TD' tablerow='2' />"), /tablerow/);
  assert.match(ng("<webctrl tag='DIV' id='a*b*c' />"), /ワイルドカード/);
});
