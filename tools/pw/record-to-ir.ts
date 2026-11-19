// Playwright（TypeScript）の記録（tools/pw/recorder.ts が書く JSON）から、IR と <P>/ir/repository.json を作る（AUT-1219）。
//
//   node tools/pw/record-to-ir.ts --project <P> --workflow <名前> [--app <アプリ名>] [--browser Chrome|Edge]
//        [--interaction-mode <NInteractionMode>] [--no-incognito] <record.ja.json> [<record.en.json>]
//   --no-incognito  カードをシークレット ウィンドウ（IsIncognito）にしない（既定は、記録と同じく Cookie・サインインの残らないウィンドウ）
//
// - 記録は 1 つ（1 つの言語）か 2 つ（日本語と英語）。2 つなら手順の順番で突き合わせる（操作と名前が同じであること）
// - 書くもの：<P>/ir/<名前>.json（ワークフローの IR。ターゲットは $ref）、<P>/ir/repository.json（同じ名前のアプリを置き換える）、
//   <P>/ir/<名前>.conversion.md（要素ごとに選んだセレクターと理由、変換できなかったもの）
// - そのあと objrepo.ts build → gen.ts / gen-coded.ts で XAML と Coded（Descriptors）を作る
//
// セレクターの選び方（言語によらない属性を先に使う。どの記録でも 1 つに決まるものだけ）：
//   1. テスト用の属性（data-testid、data-cy、data-e2e、data-test、data-qa）
//   2. id（作られた値に見えるものは使わない）、name
//   3. aria-label → 属性 aria-label。言語で値が違えば、両方の値の正規表現（matching:aria-label='regex'）。
//      aaname は aria-label ではなく表示の文字に当たる（DESKTOP のロボットで確かめた。2026-11-19）
//   4. 表示文字 → innertext。言語で違えば、両方の値の正規表現
//   5. どれでも決まらなければ css-selector（記録のときの CSS のパス）。壊れやすいので一覧に出す

import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

export type Snapshot = {
  tag: string;
  attrs: Record<string, string>;
  text: string;
  value: string | null;
  role: string | null;
  css: string;
  ancestors: Record<string, string | number>[]; // key・keyCount・innerTag・innerText は複数行のセレクター用（recorder.ts）
  counts: Record<string, number>;
  inShadow: boolean;
  inFrame: boolean;
  anchor?: { tag: string; text: string; textCount: number }; // 近くのラベル（アンカーの候補）
  frame?: { tag: string; attrs: Record<string, string>; counts: Record<string, number> }; // 入っている iframe（同じオリジンのとき）
  formValues?: string[]; // 中の入力欄の値（UiPath の Get Text はこれも文字に入れる。記録では Get Attribute の innertext で読むので、参考に残すだけ）
  locatorCount?: number;
};
export type Step = {
  i: number;
  action: "goto" | "click" | "fill" | "text" | "wait" | "clickIf" | "unsupported";
  appeared?: boolean; // clickIf：出たかどうか（出なければ element が無い）
  app?: string; // objects のアプリの名前（recorder が要素から取る）
  screen?: string;
  name?: string;
  direct?: boolean; // セレクターをコードにじかに書いた
  page?: { url: string; title: string; lang: string };
  element?: Snapshot;
  url?: string;
  urlArg?: string;
  urlAfter?: string;
  value?: string;
  valueArg?: string;
  outVar?: string;
  result?: string;
  timeoutMs?: number;
  what?: string;
  detail?: string;
};
// userDataDir：サインイン済みのプロファイルで記録したとき、そのフォルダ（カードを UserDataFolderMode=CustomFolder にする）
export type Recording = { version: number; locale: string; browser?: string; browserVersion?: string; incognito?: boolean; userDataDir?: string; recordedAt?: string; steps: Step[] };

// perSnap：言語で値が違うとき、記録ごと（snaps の順）の、その言語だけのセレクター（pw/objects でロケールごとに使う）
// anchor：アンカーのセレクター（あれば、本体は FuzzySelector＋PositioningType=Closest で探す）。frameError：iframe の行を作れなかった理由
export type Choice = { selector: string; basis: string; languageIndependent: boolean; fragile: boolean; perSnap?: string[]; anchor?: string; frameError?: string };
export type Unconverted = { step: number; what: string; why: string };
// incognito：false でなければ、記録が新しいコンテキスト（incognito: true）のとき、カードを IsIncognito=True（シークレット ウィンドウ）にする
export type ConvertOptions = { workflow: string; app: string; browser: "Chrome" | "Edge"; interactionMode?: string; incognito?: boolean };
export type ConvertResult = {
  ir: Record<string, unknown>;
  app: Record<string, unknown>;
  choices: { screen: string; name: string; choice: Choice; locales: string[] }[];
  unconverted: Unconverted[];
  warnings: string[];
};

const TEST_ATTRS = ["data-testid", "data-cy", "data-e2e", "data-test", "data-qa"];

// 作られた値に見える id（Angular Material の mat-input-3、React の :r1:、数字の多いもの、GUID）
export const generatedId = (v: string) =>
  /^(mat|cdk|ng|mui|ember|ext)-/i.test(v) || /^:r\w*:$/.test(v) || /\d{3,}/.test(v) || /^[0-9a-f-]{16,}$/i.test(v) || /-\d+$/.test(v);

const q = (v: string) => v.replace(/&/g, "&amp;").replace(/'/g, "&apos;");
const reEsc = (v: string) => v.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const same = (xs: string[]) => xs.every((x) => x === xs[0]);
const unique = (snaps: Snapshot[], key: string) => snaps.every((s) => s.counts?.[key] === 1);

// 表示文字・aria-label を、言語で違えば正規表現にする
function textAttr(attr: "aria-label" | "innertext", vals: string[]): { part: string; independent: boolean; perSnap?: string[] } {
  const uniq = [...new Set(vals)];
  if (uniq.length === 1) return { part: `${attr}='${q(uniq[0])}'`, independent: false };
  return {
    part: `${attr}='^(${uniq.map((v) => q(reEsc(v))).join("|")})$' matching:${attr}='regex'`, independent: false,
    // innertext は UiPath では全体の一致なので、そのままの値でよい
    perSnap: vals.map((v) => `${attr}='${q(v)}'`),
  };
}

// iframe の中の要素なら、先頭に iframe の行（<webctrl tag='IFRAME' id='…' />）を足す。DESKTOP のロボットで、この形で iframe の中を探せた（AUT-1221）
export function chooseSelector(snaps: Snapshot[]): Choice {
  const c = chooseInDocument(snaps);
  if (!snaps.some((s) => s.inFrame)) return c;
  const frames = snaps.map((s) => s.frame);
  if (!frames.every(Boolean)) return { ...c, frameError: "別のオリジンの iframe の中の要素（iframe の属性を読めない）" };
  const key = ["id", "name", "title", "data-testid", "src"].find((k) => frames.every((f) => f!.attrs[k] && f!.counts[k] === 1) && same(frames.map((f) => f!.attrs[k])));
  if (!key) return { ...c, frameError: "iframe を 1 つに決める属性（id・name・title・data-testid・src）が無い" };
  const row = `<webctrl tag='${frames[0]!.tag.toUpperCase()}' ${key}='${q(frames[0]!.attrs[key])}' />`;
  return { ...c, selector: row + c.selector, perSnap: c.perSnap?.map((p) => row + p), anchor: c.anchor && row + c.anchor, basis: `iframe（${key}）＋${c.basis}` };
}

function chooseInDocument(snaps: Snapshot[]): Choice {
  const tag = snaps[0].tag.toUpperCase();
  const has = (k: string) => snaps.every((s) => s.attrs[k] !== undefined && s.attrs[k] !== "");
  const vals = (k: string) => snaps.map((s) => s.attrs[k]);
  // 1. テスト用の属性
  for (const k of TEST_ATTRS) {
    if (has(k) && same(vals(k)) && unique(snaps, k))
      return { selector: `<webctrl tag='${tag}' ${k}='${q(vals(k)[0])}' />`, basis: k, languageIndependent: true, fragile: false };
  }
  // 2. id、name
  if (has("id") && same(vals("id")) && !generatedId(vals("id")[0]) && unique(snaps, "id"))
    return { selector: `<webctrl tag='${tag}' id='${q(vals("id")[0])}' />`, basis: "id", languageIndependent: true, fragile: false };
  if (has("name") && same(vals("name")) && unique(snaps, "name"))
    return { selector: `<webctrl tag='${tag}' name='${q(vals("name")[0])}' />`, basis: "name", languageIndependent: true, fragile: false };
  // テスト用の属性があるが 1 つに決まらないとき、type などと組み合わせない（UiPath の一致の数は確かめられない）。次へ
  // 3. aria-label → 属性 aria-label（aaname ではない。aaname は表示の文字に当たり、aria-label の値では見つからなかった）
  if (has("aria-label") && unique(snaps, "aria-label")) {
    const t = textAttr("aria-label", vals("aria-label"));
    return { selector: `<webctrl tag='${tag}' ${t.part} />`, basis: same(vals("aria-label")) ? "aria-label" : "aria-label（2 言語）", languageIndependent: false, fragile: false, perSnap: t.perSnap?.map((p) => `<webctrl tag='${tag}' ${p} />`) };
  }
  // 4. 表示文字
  if (snaps.every((s) => s.text && s.counts?.["#text"] === 1)) {
    const t = textAttr("innertext", snaps.map((s) => s.text));
    return { selector: `<webctrl tag='${tag}' ${t.part} />`, basis: same(snaps.map((s) => s.text)) ? "表示文字" : "表示文字（2 言語）", languageIndependent: false, fragile: false, perSnap: t.perSnap?.map((p) => `<webctrl tag='${tag}' ${p} />`) };
  }
  // タグだけで 1 つ（BODY、H1 など）
  if (snaps.every((s) => s.counts?.["#tag"] === 1))
    return { selector: `<webctrl tag='${tag}' />`, basis: "タグだけで 1 つ", languageIndependent: true, fragile: false };
  // 6. 親から絞り込む（複数行のセレクター）：言語によらない属性で 1 つに決まる祖先と、その中で 1 つに決まるタグ（か表示文字）
  for (let i = 0; i < 4; i++) {
    const as = snaps.map((s) => s.ancestors?.[i]);
    if (!as.every((a) => a && a.key && a.keyCount === 1 && a.key === as[0]!.key)) continue;
    const key = String(as[0]!.key);
    const pv = as.map((a) => String(a![key]));
    if (!same(pv) || (key === "id" && generatedId(pv[0]))) continue;
    const parent = `<webctrl tag='${String(as[0]!.tag).toUpperCase()}' ${key}='${q(pv[0])}' />`;
    if (as.every((a) => a!.innerTag === 1))
      return { selector: `${parent}<webctrl tag='${tag}' />`, basis: `親（${key}）＋タグ`, languageIndependent: true, fragile: false };
    if (snaps.every((s, k) => s.text && as[k]!.innerText === 1)) {
      const t = textAttr("innertext", snaps.map((s) => s.text));
      return { selector: `${parent}<webctrl tag='${tag}' ${t.part} />`, basis: `親（${key}）＋表示文字`, languageIndependent: false, fragile: false, perSnap: t.perSnap?.map((p) => `${parent}<webctrl tag='${tag}' ${p} />`) };
    }
  }
  // 7. 近くのラベル（アンカー）：本体はタグ（とクラス）で探し、いくつか当たったら、ラベルにいちばん近いものを使う
  //    UiPath は FuzzySelector＋PositioningType=Closest のときだけアンカーを使う（Selector では使わない。AUT-1221 で確かめた）
  if (snaps.every((s) => s.anchor && s.anchor.textCount === 1) && same(snaps.map((s) => s.anchor!.tag))) {
    const at = textAttr("innertext", snaps.map((s) => s.anchor!.text));
    const atag = snaps[0].anchor!.tag.toUpperCase();
    const cls = has("class") && same(vals("class")) ? ` class='${q(vals("class")[0])}'` : "";
    return { selector: `<webctrl tag='${tag}'${cls} />`, anchor: `<webctrl tag='${atag}' ${at.part} />`, basis: same(snaps.map((s) => s.anchor!.text)) ? "近くのラベル（アンカー）" : "近くのラベル（アンカー、2 言語）", languageIndependent: false, fragile: false };
  }
  // 8. CSS のパス
  const css = snaps[0].css;
  return { selector: `<webctrl css-selector='${q(css)}' tag='${tag}' />`, basis: "CSS のパス", languageIndependent: same(snaps.map((s) => s.css)), fragile: true };
}

const TAXONOMY: Record<string, [string, string]> = {
  click: ["Button", "Click"],
  fill: ["Input", "TypeInto"],
  text: ["Text", "GetAttribute"],
  wait: ["Text", "CheckState"],
  clickIf: ["Button", "Click"],
};
const ELEMENT_TYPE: Record<string, string> = { BUTTON: "Button", INPUT: "InputBox", TEXTAREA: "InputBox", A: "HyperLink", SELECT: "DropDown" };

function urlPattern(urls: string[]): string {
  const u = new URL(urls[0]);
  if (u.protocol === "file:") return urls[0];
  return `${u.protocol}//${u.host}/*`;
}

export function convert(recs: Recording[], opt: ConvertOptions): ConvertResult {
  if (!recs.length) throw new Error("記録が無い");
  const base = recs[0].steps;
  for (const r of recs.slice(1)) {
    if (r.steps.length !== base.length) throw new Error(`記録の手順の数が違う: ${recs[0].locale} ${base.length} / ${r.locale} ${r.steps.length}`);
    r.steps.forEach((s, i) => {
      if (s.action !== base[i].action || s.name !== base[i].name || s.screen !== base[i].screen)
        throw new Error(`手順 ${i} が記録で違う: ${base[i].action} ${base[i].name ?? ""} / ${s.action} ${s.name ?? ""}`);
    });
  }
  const locales = recs.map((r) => r.locale);
  const unconverted: Unconverted[] = [];
  const warnings: string[] = [];
  // アプリの名前：objects の要素で記録したなら、その名前（--app より先）。じかに書いた手順は警告にする
  const stepApps = [...new Set(base.map((s) => s.app).filter((x): x is string => !!x))];
  if (stepApps.length > 1) throw new Error(`記録に、アプリが ${stepApps.length} つある（${stepApps.join("、")}）。1 つの記録は 1 つのアプリにする`);
  const app = stepApps[0] ?? opt.app;
  base.forEach((s, i) => {
    if (recs.some((r) => r.steps[i].direct))
      warnings.push(`手順 ${i}（${s.screen ?? ""}/${s.name ?? s.action}）は、セレクターをコードにじかに書いている。pw/objects に定義して、名前で指す（UiPath でリポジトリに登録するのと同じ）`);
  });
  const browserApp = opt.browser === "Edge" ? "msedge.exe" : "chrome.exe";

  // 画面（記録の screen の名前ごと）と要素
  type Scr = { name: string; urls: string[]; openUrl?: string; elements: Map<string, { snaps: Snapshot[]; locales: string[]; action: string; choice?: Choice }> };
  const screens = new Map<string, Scr>();
  const scr = (name: string) => {
    if (!screens.has(name)) screens.set(name, { name, urls: [], elements: new Map() });
    return screens.get(name)!;
  };
  base.forEach((s, i) => {
    if (s.action === "unsupported") {
      unconverted.push({ step: i, what: s.what ?? "?", why: `Playwright にしか無い操作（${s.detail ?? ""}）` });
      return;
    }
    const sc = scr(s.screen ?? "画面");
    for (const r of recs) {
      const st = r.steps[i];
      if (st.page?.url) sc.urls.push(st.page.url);
      // 開く URL は、スクリプトが開いた URL（転送のあとの URL には、毎回変わる値が入ることがある）。セレクターの url は転送のあとのページから作る
      if (st.action === "goto" && st.url) sc.openUrl ??= st.url;
    }
    if (s.action === "goto") return;
    const snaps = recs.map((r) => r.steps[i].element!).filter(Boolean);
    if (s.action === "clickIf") {
      // 出たときだけ押すもの（Cookie のバナーなど）。出なかった言語の記録には要素が無い
      if (!snaps.length) { unconverted.push({ step: i, what: s.name ?? "", why: "どの記録でも出なかったので、要素の属性が分からない" }); return; }
      if (snaps.length !== recs.length) warnings.push(`手順 ${i}（${s.name}）は ${recs.filter((r) => r.steps[i].element).map((r) => r.locale).join("・")} の記録でしか出なかった。セレクターはその記録だけから決めた`);
    } else if (snaps.length !== recs.length) throw new Error(`手順 ${i}（${s.name}）に要素の記録が無い`);
    for (const sn of snaps) {
      if (sn.inShadow) warnings.push(`手順 ${i}（${s.name}）は Shadow DOM の中。UiPath で探せるかは確かめていない`);
      if ((sn.locatorCount ?? 1) > 1) warnings.push(`手順 ${i}（${s.name}）の locator は ${sn.locatorCount} 個に当たった（記録は先頭の要素）`);
    }
    const key = s.name ?? `要素${i}`;
    const prev = sc.elements.get(key);
    if (prev) {
      if (prev.snaps[0].css !== snaps[0].css) warnings.push(`要素「${key}」が別の要素に当たっている（${prev.snaps[0].css} / ${snaps[0].css}）。先のものを使う`);
      return;
    }
    sc.elements.set(key, { snaps, locales: recs.filter((r) => r.steps[i].element).map((r) => r.locale), action: s.action });
  });

  const choices: ConvertResult["choices"] = [];
  const repoScreens = [...screens.values()].map((sc) => {
    // 要素のターゲットにも、画面（ブラウザー）のセレクターを ScopeSelectorArgument で持たせる。
    // 無いと、ロボットでは Go To URL の「ページ本体」が見つからなかった（2026-11-19、DESKTOP。リポジトリを使わず Scope を書いたものは通った）
    const scope = { lit: `<html app='${browserApp}' url='${q(urlPattern(sc.urls))}' />` };
    const elements: Record<string, unknown>[] = [
      { name: "ページ本体", taxonomy: "Text", activityType: "GoToUrl", target: { FullSelectorArgument: { lit: "<webctrl tag='BODY' />" }, ScopeSelectorArgument: scope, SearchSteps: "Selector" } },
    ];
    for (const [name, e] of sc.elements) {
      if (name === "ページ本体") throw new Error(`要素の名前「ページ本体」は使えない（URL を開くための要素の名前）`);
      e.choice = chooseSelector(e.snaps);
      choices.push({ screen: sc.name, name, choice: e.choice, locales });
      if (e.choice.fragile) unconverted.push({ step: -1, what: `${sc.name}/${name}`, why: `言語によらない属性も、1 つに決まる属性も無い。CSS のパス（${e.snaps[0].css}）で探す。画面が変わると壊れやすい` });
      const [taxonomy, activityType] = TAXONOMY[e.action] ?? ["Text", "Click"];
      if (e.choice.frameError) unconverted.push({ step: -1, what: `${sc.name}/${name}`, why: e.choice.frameError });
      // アンカーがあれば、Studio と同じく FuzzySelector で探し、いくつか当たったらアンカーにいちばん近いもの（PositioningType=Closest）を使う
      const target: Record<string, unknown> = e.choice.anchor
        ? { FuzzySelectorArgument: { lit: e.choice.selector }, ScopeSelectorArgument: scope, SearchSteps: "FuzzySelector", PositioningType: "Closest", Anchors: [{ FullSelectorArgument: { lit: e.choice.anchor }, SearchSteps: "Selector" }] }
        : { FullSelectorArgument: { lit: e.choice.selector }, ScopeSelectorArgument: scope, SearchSteps: "Selector" };
      const et = ELEMENT_TYPE[e.snaps[0].tag.toUpperCase()];
      if (et) target.ElementType = et;
      const el: Record<string, unknown> = { name, taxonomy, activityType, target };
      // 言語で値が違うときは、ロケールごとのセレクターも持たせる（pw-objects.ts が Playwright の objects でロケールごとに使う。UiPath は target の正規表現を使う）
      if (e.choice.perSnap) el.locales = Object.fromEntries(e.locales.map((l, k) => [l, e.choice!.perSnap![k]]));
      elements.push(el);
    }
    const screen: Record<string, unknown> = {
      name: sc.name,
      target: { BrowserType: opt.browser, Selector: scope, Url: { lit: sc.openUrl ?? sc.urls[0] }, IsExactTitleEnabled: false },
      elements,
    };
    if (opt.interactionMode) screen.interactionMode = opt.interactionMode;
    return screen;
  });
  const repoApp = { name: app, version: "1.0.0", screens: repoScreens };

  // ワークフロー：最初の画面のカードの中に、手順を順に置く。画面が変わったら、その画面のカード（開かない・閉じない）に入れる
  const args: Record<string, unknown>[] = [];
  const vars: Record<string, unknown>[] = [];
  const addArg = (name: string, dir: "In" | "Out", def?: string) => {
    if (args.some((a) => a.name === name)) return;
    // In の引数の既定値は、最初の記録で使った値（Studio で、引数を渡さずにそのままデバッグできるように）
    args.push(def !== undefined && dir === "In" ? { name, dir, type: "String", default: { lit: def } } : { name, dir, type: "String" });
  };
  const addVar = (name: string) => {
    if (name.startsWith("out_")) return addArg(name, "Out");
    if (!vars.some((v) => v.name === name)) vars.push({ name, type: "String" });
  };
  const ref = (screen: string, el: string) => ({ $ref: [app, screen, el] });
  const firstScreen = base.find((s) => s.action !== "unsupported")?.screen ?? "画面";
  const outer: Record<string, unknown> = {
    act: "NApplicationCard",
    name: `${firstScreen} を開く`,
    objs: { TargetApp: { $ref: [app, firstScreen] } },
    props: {
      OpenMode: "Always", CloseMode: "Always",
      ...(opt.interactionMode ? { InteractionMode: opt.interactionMode } : {}),
      // 記録は Cookie・サインインの残らないコンテキストで取ったので、UiPath でもシークレット ウィンドウで開く（利用者のプロファイルの状態で画面が変わらないように）
      ...(opt.incognito !== false && recs.every((r) => r.incognito) ? { IsIncognito: true } : {}),
      // サインイン済みのプロファイルで記録したなら、UiPath でも同じプロファイルで開く（ロボットが同じ利用者・同じ PC で動くとき）
      ...(recs[0].userDataDir ? { UserDataFolderMode: "CustomFolder", UserDataFolderPath: { lit: recs[0].userDataDir } } : {}),
    },
    body: [] as unknown[],
  };
  let cur = outer.body as unknown[];
  let curScreen = firstScreen;
  const strExpr = (lit: string | undefined, arg: string | undefined) => {
    if (arg) {
      addArg(arg, "In", lit);
      return arg;
    }
    return { lit: lit ?? "" };
  };
  base.forEach((s, i) => {
    if (s.action === "unsupported") {
      cur.push({ act: "LogMessage", name: `変換できない手順 ${i}`, props: { Level: "Warn", Message: { lit: `変換できない手順 ${i}: ${s.what}（${s.detail ?? ""}）` } } });
      return;
    }
    const sc = s.screen ?? "画面";
    if (sc !== curScreen) {
      const inner = { act: "NApplicationCard", name: `${sc} につなぐ`, objs: { TargetApp: { $ref: [app, sc] } }, props: { OpenMode: "Never", CloseMode: "Never" }, body: [] as unknown[] };
      (outer.body as unknown[]).push(inner);
      cur = inner.body;
      curScreen = sc;
    }
    switch (s.action) {
      case "goto":
        cur.push({ act: "NGoToUrl", name: `${sc} の URL を開く`, objs: { Target: ref(sc, "ページ本体") }, props: { Url: strExpr(s.url, s.urlArg) } });
        break;
      case "click":
        cur.push({ act: "NClick", name: `${s.name} を押す`, objs: { Target: ref(sc, s.name!) } });
        break;
      case "fill":
        cur.push({ act: "NTypeInto", name: `${s.name} に入れる`, objs: { Target: ref(sc, s.name!) }, props: { Text: strExpr(s.value, s.valueArg) } });
        break;
      case "text": {
        const v = s.outVar ?? `text${i}`;
        addVar(v);
        // Get Text（NGetText）ではなく、Get Attribute の innertext で読む。Playwright の innerText と同じ文字になる。
        // Get Text は、要素の中や上に重なった見えない入力欄の値まで入れる（「English」が「Englishen」）。ScrapingMethod・ScrapingOptions のどれでも外せなかった（2026-11-19、DESKTOP）
        cur.push({ act: "NGetAttributeGeneric", typeArg: "String", name: `${s.name} を読む`, objs: { Target: ref(sc, s.name!) }, props: { Attribute: { lit: "innertext" }, Result: v } });
        cur.push({ act: "LogMessage", props: { Level: "Info", Message: `"${s.name}: " & ${v}` } });
        break;
      }
      case "wait": {
        const v = `found${i}`;
        if (!vars.some((x) => x.name === v)) vars.push({ name: v, type: "Boolean" });
        cur.push({ act: "NCheckState", name: `${s.name} を待つ`, objs: { Target: ref(sc, s.name!) }, props: { Mode: "WaitAppear", Timeout: String(Math.round((s.timeoutMs ?? 30000) / 1000)), Exists: v } });
        cur.push({ act: "If", props: { Condition: `Not ${v}` }, then: [{ act: "Throw", props: { Exception: `New Exception("${s.name} が出ない")` } }] });
        break;
      }
      case "clickIf": {
        // 出たときだけ押す：Check State（出るまで待つ。出なくても止めない）＋ If ＋ Click
        if (!screens.get(sc)?.elements.has(s.name!)) break; // どの記録でも出なかった（一覧に出してある）
        const v = `found${i}`;
        if (!vars.some((x) => x.name === v)) vars.push({ name: v, type: "Boolean" });
        cur.push({ act: "NCheckState", name: `${s.name} が出たか`, objs: { Target: ref(sc, s.name!) }, props: { Mode: "WaitAppear", Timeout: String(Math.round((s.timeoutMs ?? 5000) / 1000)), Exists: v } });
        cur.push({ act: "If", props: { Condition: v }, then: [{ act: "NClick", name: `${s.name} を押す`, objs: { Target: ref(sc, s.name!) } }] });
        break;
      }
    }
  });
  const ir: Record<string, unknown> = { workflow: opt.workflow };
  if (args.length) ir.arguments = args;
  if (vars.length) ir.variables = vars;
  ir.body = [outer];
  return { ir, app: repoApp, choices, unconverted, warnings };
}

export function report(res: ConvertResult, recs: Recording[]): string {
  const lines = [`# ${String(res.ir.workflow)}：Playwright の記録からの変換`, "", `記録：${recs.map((r) => `${r.locale}（手順 ${r.steps.length}）`).join("、")}`, ""];
  lines.push("## 要素ごとのセレクター", "", "| 画面 | 要素 | セレクター | 決め手 | 言語によらない |", "| --- | --- | --- | --- | --- |");
  const cell = (x: string) => `\`${x.replace(/\|/g, "\\|")}\``;
  for (const c of res.choices) lines.push(`| ${c.screen} | ${c.name} | ${cell(c.choice.selector)}${c.choice.anchor ? `（アンカー ${cell(c.choice.anchor)}）` : ""} | ${c.choice.basis} | ${c.choice.languageIndependent ? "○" : "—"} |`);
  lines.push("", "## 変換できなかったもの", "");
  if (!res.unconverted.length) lines.push("なし");
  for (const u of res.unconverted) lines.push(`- ${u.step >= 0 ? `手順 ${u.step}：` : ""}${u.what}：${u.why}`);
  if (res.warnings.length) {
    lines.push("", "## 注意", "");
    for (const w of res.warnings) lines.push(`- ${w}`);
  }
  return lines.join("\n") + "\n";
}

function main(argv: string[]) {
  let project = "";
  let workflow = "";
  let app = "";
  let browser: "Chrome" | "Edge" = "Chrome";
  let interactionMode: string | undefined;
  let incognito = true;
  const files: string[] = [];
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--project") project = argv[++i];
    else if (a === "--workflow") workflow = argv[++i];
    else if (a === "--app") app = argv[++i];
    else if (a === "--browser") browser = argv[++i] as "Chrome" | "Edge";
    else if (a === "--interaction-mode") interactionMode = argv[++i];
    else if (a === "--no-incognito") incognito = false;
    else if (a.startsWith("--")) throw new Error(`知らないオプション: ${a}`);
    else files.push(a);
  }
  if (!project || !workflow || !files.length) {
    console.error("使い方: node tools/pw/record-to-ir.ts --project <P> --workflow <名前> [--app <アプリ名>] [--browser Chrome|Edge] [--interaction-mode <モード>] [--no-incognito] <記録.json>...");
    process.exit(2);
  }
  const recs = files.map((f) => JSON.parse(readFileSync(f, "utf8").replace(/^\uFEFF/, "")) as Recording);
  const res = convert(recs, { workflow, app: app || `${browser}（${workflow}）`, browser, interactionMode, incognito });
  const irDir = join(project, "ir");
  mkdirSync(irDir, { recursive: true });
  writeFileSync(join(irDir, `${workflow}.json`), JSON.stringify(res.ir, null, 2) + "\n");
  // repository.json：同じ名前のアプリは置き換える（Id は名前が同じ画面・要素から引き継ぐ）
  const repoFile = join(irDir, "repository.json");
  const repo = existsSync(repoFile) ? JSON.parse(readFileSync(repoFile, "utf8")) : { apps: [] };
  const old = (repo.apps as Record<string, unknown>[]).find((a) => a.name === res.app.name);
  if (old) carryIds(old, res.app);
  repo.apps = [...(repo.apps as Record<string, unknown>[]).filter((a) => a.name !== res.app.name), res.app];
  writeFileSync(repoFile, JSON.stringify(repo, null, 2) + "\n");
  writeFileSync(join(irDir, `${workflow}.conversion.md`), report(res, recs));
  console.log(`OK ${join(irDir, `${workflow}.json`)}、repository.json（アプリ「${res.app.name}」）`);
  for (const c of res.choices) console.log(`  ${c.screen}/${c.name}: ${c.choice.selector}${c.choice.anchor ? ` アンカー ${c.choice.anchor}` : ""}（${c.choice.basis}）`);
  if (res.unconverted.length) console.log(`変換できなかったもの ${res.unconverted.length} 件 → ${workflow}.conversion.md`);
  for (const w of res.warnings) console.log(`注意: ${w}`);
}

// 前の repository.json の Id（アプリ・バージョン・画面・要素）を、名前が同じものに引き継ぐ（XAML の Reference が変わらないように）
export function carryIds(old: Record<string, unknown>, next: Record<string, unknown>) {
  for (const k of ["id", "versionId"]) if (old[k]) next[k] = old[k];
  const oldScreens = (old.screens as Record<string, unknown>[]) ?? [];
  for (const s of (next.screens as Record<string, unknown>[]) ?? []) {
    const os = oldScreens.find((x) => x.name === s.name);
    if (!os) continue;
    if (os.id) s.id = os.id;
    const oldEls = (os.elements as Record<string, unknown>[]) ?? [];
    for (const e of (s.elements as Record<string, unknown>[]) ?? []) {
      const oe = oldEls.find((x) => x.name === e.name);
      if (oe?.id) e.id = oe.id;
    }
  }
}

if (import.meta.url === `file:///${process.argv[1]?.replace(/\\/g, "/").replace(/^\//, "")}` || process.argv[1]?.endsWith("record-to-ir.ts")) {
  try {
    main(process.argv.slice(2));
  } catch (e) {
    console.error(`NG ${(e as Error).message}`);
    process.exit(1);
  }
}
