import { strict as assert } from "node:assert";
import { test } from "node:test";
import { chooseSelector, convert, generatedId, report, type Recording, type Snapshot } from "./record-to-ir.ts";

const snap = (p: Partial<Snapshot>): Snapshot => ({
  tag: "BUTTON",
  attrs: {},
  text: "",
  value: null,
  role: null,
  css: "body > button",
  ancestors: [],
  counts: {},
  inShadow: false,
  inFrame: false,
  ...p,
});

test("テスト用の属性を先に使う（言語によらない）", () => {
  const ja = snap({ attrs: { "data-cy": "run-btn", "aria-label": "実行" }, text: "実行", counts: { "data-cy": 1, "aria-label": 1, "#text": 1 } });
  const en = snap({ attrs: { "data-cy": "run-btn", "aria-label": "Run" }, text: "Run", counts: { "data-cy": 1, "aria-label": 1, "#text": 1 } });
  const c = chooseSelector([ja, en]);
  assert.equal(c.selector, "<webctrl tag='BUTTON' data-cy='run-btn' />");
  assert.equal(c.languageIndependent, true);
});

test("1 つに決まらないテスト用の属性は飛ばす", () => {
  const s = snap({ tag: "INPUT", attrs: { "data-testid": "input-el", id: "email" }, counts: { "data-testid": 3, id: 1 } });
  assert.equal(chooseSelector([s]).selector, "<webctrl tag='INPUT' id='email' />");
});

test("作られた id は使わない", () => {
  assert.equal(generatedId("mat-input-3"), true);
  assert.equal(generatedId(":r1:"), true);
  assert.equal(generatedId("item-12345"), true);
  assert.equal(generatedId("email"), false);
  const s = snap({ tag: "INPUT", attrs: { id: "mat-input-0", name: "q" }, counts: { id: 1, name: 1 } });
  assert.equal(chooseSelector([s]).selector, "<webctrl tag='INPUT' name='q' />");
});

test("aria-label は属性 aria-label。言語で違えば、両方の値の正規表現にする", () => {
  const ja = snap({ attrs: { "aria-label": "アプリを実行" }, counts: { "aria-label": 1 } });
  const en = snap({ attrs: { "aria-label": "Run app" }, counts: { "aria-label": 1 } });
  const c = chooseSelector([ja, en]);
  assert.equal(c.selector, "<webctrl tag='BUTTON' aria-label='^(アプリを実行|Run app)$' matching:aria-label='regex' />");
  assert.equal(c.languageIndependent, false);
  assert.equal(c.basis, "aria-label（2 言語）");
});

test("表示文字は innertext。正規表現の記号は逃がす", () => {
  const ja = snap({ text: "保存 & デバッグ", counts: { "#text": 1 } });
  const en = snap({ text: "Save & Debug (F5)", counts: { "#text": 1 } });
  assert.equal(chooseSelector([ja, en]).selector, "<webctrl tag='BUTTON' innertext='^(保存 &amp; デバッグ|Save &amp; Debug \\(F5\\))$' matching:innertext='regex' />");
});

test("決まらなければ CSS のパス（壊れやすい）", () => {
  const s = snap({ tag: "DIV", css: "body > div:nth-of-type(2)", counts: { "#tag": 5, "#text": 2 }, text: "x" });
  const c = chooseSelector([s]);
  assert.equal(c.selector, "<webctrl css-selector='body &gt; div:nth-of-type(2)' tag='DIV' />".replace("&gt;", ">"));
  assert.equal(c.fragile, true);
});

const rec = (locale: string, label: string, btn: string): Recording => ({
  version: 1,
  locale,
  steps: [
    { i: 0, action: "goto", screen: "フォーム", url: "https://example.test/form", urlArg: "in_Url", page: { url: "https://example.test/form", title: "t", lang: locale } },
    { i: 1, action: "fill", screen: "フォーム", name: "名前", value: "太郎", valueArg: "in_Name", element: snap({ tag: "INPUT", attrs: { id: "name" }, counts: { id: 1 } }) },
    { i: 2, action: "click", screen: "フォーム", name: "送る", element: snap({ attrs: { "aria-label": btn }, counts: { "aria-label": 1 } }) },
    { i: 3, action: "text", screen: "結果", name: "結果", outVar: "out_Result", page: { url: "https://example.test/done", title: "t", lang: locale }, element: snap({ tag: "DIV", attrs: { "data-testid": "result" }, text: label, counts: { "data-testid": 1 } }) },
    { i: 4, action: "unsupported", what: "page.Route", detail: "画像を止める" },
  ],
});

test("2 つの言語の記録から、IR とリポジトリを作る", () => {
  const res = convert([rec("ja-JP", "完了", "送信"), rec("en-US", "Done", "Send")], { workflow: "Form", app: "テスト用フォーム", browser: "Chrome" });
  const app = res.app as { screens: { name: string; target: { Selector: { lit: string } }; elements: { name: string; target: { FullSelectorArgument: { lit: string } } }[] }[] };
  assert.deepEqual(app.screens.map((s) => s.name), ["フォーム", "結果"]);
  assert.equal(app.screens[0].target.Selector.lit, "<html app='chrome.exe' url='https://example.test/*' />");
  const send = app.screens[0].elements.find((e) => e.name === "送る")!;
  assert.equal(send.target.FullSelectorArgument.lit, "<webctrl tag='BUTTON' aria-label='^(送信|Send)$' matching:aria-label='regex' />");
  // 引数と、画面ごとのカード
  assert.deepEqual(res.ir.arguments, [
    { name: "in_Url", dir: "In", type: "String", default: { lit: "https://example.test/form" } }, // 既定値は最初の記録の値
    { name: "in_Name", dir: "In", type: "String", default: { lit: "太郎" } },
    { name: "out_Result", dir: "Out", type: "String" },
  ]);
  const outer = (res.ir.body as { act: string; body: { act: string; objs?: { TargetApp?: unknown } }[] }[])[0];
  assert.equal(outer.act, "NApplicationCard");
  assert.deepEqual(outer.body.map((n) => n.act), ["NGoToUrl", "NTypeInto", "NClick", "NApplicationCard"]);
  // 変換できないものは一覧に出し、ワークフローにも警告のログを残す
  assert.equal(res.unconverted.length, 1);
  assert.match(res.unconverted[0].why, /Playwright にしか無い/);
  assert.match(report(res, []), /page\.Route/);
});

test("記録の手順が食い違えば止める", () => {
  const a = rec("ja-JP", "完了", "送信");
  const b = rec("en-US", "Done", "Send");
  b.steps[2].name = "別の名前";
  assert.throws(() => convert([a, b], { workflow: "Form", app: "x", browser: "Chrome" }), /手順 2/);
});

test("開く URL は、転送の前の URL（セレクターの url は転送のあとのページ）", () => {
  const r = rec("ja-JP", "完了", "送信");
  r.steps[0].page = { url: "https://login.example.test/auth?nonce=xyz", title: "t", lang: "ja" };
  const res = convert([r], { workflow: "Form", app: "x", browser: "Chrome" });
  const sc = (res.app as { screens: { target: { Url: { lit: string }; Selector: { lit: string } } }[] }).screens[0];
  assert.equal(sc.target.Url.lit, "https://example.test/form");
  assert.equal(sc.target.Selector.lit, "<html app='chrome.exe' url='https://login.example.test/*' />");
});

test("新しいコンテキストの記録（incognito）なら、カードをシークレット ウィンドウ（IsIncognito）にする", () => {
  const recs = [rec("ja-JP", "完了", "送信"), rec("en-US", "Done", "Send")].map((r) => ({ ...r, incognito: true }));
  const card = (o?: boolean) => (convert(recs, { workflow: "Form", app: "x", browser: "Chrome", incognito: o }).ir.body as { props: Record<string, unknown> }[])[0].props;
  assert.equal(card().IsIncognito, true);
  assert.equal(card(false).IsIncognito, undefined);
  // 記録に incognito が無い（古い記録）ときは付けない
  assert.equal((convert([rec("ja-JP", "完了", "送信")], { workflow: "Form", app: "x", browser: "Chrome" }).ir.body as { props: Record<string, unknown> }[])[0].props.IsIncognito, undefined);
});

test("セレクターをコードにじかに書いた手順は警告にする。objects の名前で記録したものは警告しない", () => {
  const a = rec("ja-JP", "完了", "送信");
  a.steps[2].direct = true;
  const res = convert([a], { workflow: "Form", app: "x", browser: "Chrome" });
  assert.equal(res.warnings.filter((w) => /じかに書いている/.test(w)).length, 1);
  assert.match(res.warnings.join("\n"), /手順 2（フォーム\/送る）/);
});

test("アプリの名前は、記録の要素（objects）から取る", () => {
  const a = rec("ja-JP", "完了", "送信");
  for (const s of a.steps) if (s.action !== "unsupported") s.app = "objects のアプリ";
  assert.equal((convert([a], { workflow: "Form", app: "x", browser: "Chrome" }).app as { name: string }).name, "objects のアプリ");
});

test("言語で値が違う要素は、ロケールごとのセレクター（locales）も持つ", () => {
  const res = convert([rec("ja-JP", "完了", "送信"), rec("en-US", "Done", "Send")], { workflow: "Form", app: "x", browser: "Chrome" });
  const els = (res.app as { screens: { elements: { name: string; locales?: Record<string, string> }[] }[] }).screens[0].elements;
  assert.deepEqual(els.find((e) => e.name === "送る")!.locales, { "ja-JP": "<webctrl tag='BUTTON' aria-label='送信' />", "en-US": "<webctrl tag='BUTTON' aria-label='Send' />" });
  assert.equal(els.find((e) => e.name === "名前")!.locales, undefined); // 言語によらない（id）
});

test("読み取り（text）は Get Attribute の innertext（Playwright の innerText と同じ文字。Get Text は見えない入力欄の値まで入れる）", () => {
  const res = convert([rec("ja-JP", "完了", "送信")], { workflow: "Form", app: "x", browser: "Chrome" });
  const flat = JSON.stringify(res.ir);
  assert.match(flat, /"act":"NGetAttributeGeneric","typeArg":"String","name":"結果 を読む"/);
  assert.match(flat, /"Attribute":{"lit":"innertext"},"Result":"out_Result"/);
  assert.doesNotMatch(flat, /NGetText/);
});
