import { strict as assert } from "node:assert";
import { existsSync, mkdirSync, mkdtempSync, rmSync, unlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { pathToFileURL } from "node:url";
import { loadCatalog } from "../ir/catalog.ts";
import { generate } from "../ir/generate.ts";
import { CATALOG_FILES, importXaml, repoRoot } from "../ir/import-xaml.ts";
import type { Repository } from "../ir/objrepo.ts";
import type { Workflow } from "../ir/types.ts";
import { irToPlaywright } from "./ir-to-pw.ts";
import { defineObjects } from "./objects.ts";
import { buildPwObjects, objectsSource } from "./pw-objects.ts";
import { convert } from "./record-to-ir.ts";
import { launch, UiRecorder } from "./recorder.ts";

const T = (sel: string) => ({ FullSelectorArgument: { lit: sel }, SearchSteps: "Selector" });
const SCOPE = { lit: "<html app='chrome.exe' url='https://example.test/*' />" };

// オブジェクトリポジトリ（repository.json と同じ形）
const repo: Repository = {
  apps: [{
    name: "テスト フォーム",
    screens: [{
      name: "フォーム",
      target: { BrowserType: "Chrome", Selector: SCOPE, Url: { lit: "https://example.test/form" } },
      elements: [
        { name: "名前", target: T("<webctrl tag='INPUT' name='name' />") },
        { name: "送る", target: T("<webctrl tag='BUTTON' aria-label='^(送信|Send)$' matching:aria-label='regex' />"),
          locales: { "ja-JP": "<webctrl tag='BUTTON' aria-label='送信' />", "en-US": "<webctrl tag='BUTTON' aria-label='Send' />" } },
        { name: "結果", target: T("<webctrl tag='DIV' data-testid='result' />") },
      ],
    }],
  }],
};
const ref = (el?: string) => ({ $ref: ["テスト フォーム", "フォーム", ...(el ? [el] : [])] }) as never;

// 画面操作の IR（ターゲットはリポジトリの名前で指す）
const wf: Workflow = {
  workflow: "Form",
  arguments: [{ name: "in_Name", dir: "In", type: "String" }, { name: "out_Result", dir: "Out", type: "String" }],
  variables: [{ name: "found", type: "Boolean" }],
  body: [{
    act: "NApplicationCard", name: "フォームを開く", objs: { TargetApp: ref() }, props: { OpenMode: "Always", CloseMode: "Always" },
    body: [
      { act: "NTypeInto", name: "名前", objs: { Target: ref("名前") }, props: { Text: "in_Name" } },
      { act: "NClick", name: "送る", objs: { Target: ref("送る") } },
      { act: "NCheckState", name: "結果を待つ", objs: { Target: ref("結果") }, props: { Mode: "WaitAppear", Timeout: "10", Exists: "found" } },
      { act: "If", props: { Condition: "Not found" }, then: [{ act: "Throw", props: { Exception: 'New Exception("結果が出ない")' } }] },
      { act: "NGetText", name: "結果", objs: { Target: ref("結果") }, props: { TextString: "out_Result" } },
      { act: "LogMessage", props: { Level: "Info", Message: '"結果: " & out_Result' } },
    ],
  }],
};

test("IR の画面操作を Playwright にする。セレクターはじかに書かず objects から引く", () => {
  const r = irToPlaywright(wf, repo);
  assert.deepEqual(r.unconverted, []);
  for (const line of [
    'import { getText, launch, log, waitState } from "./lib/runtime.ts";',
    'import objects from "./objects/index.ts";',
    "const O = objects(page, locale);",
    "await page.goto(O.テスト_フォーム.フォーム.$url as string);",
    "await page.waitForURL(O.テスト_フォーム.フォーム.$urlPattern as string);",
    "await O.テスト_フォーム.フォーム.名前.fill(in_Name);",
    "await O.テスト_フォーム.フォーム.送る.click();",
    'found = await waitState(O.テスト_フォーム.フォーム.結果, "visible", 10000);',
    "if (!found) {",
    'throw new Error("結果が出ない");',
    "out_Result = await getText(O.テスト_フォーム.フォーム.結果);",
    'log("Info", "結果: " + out_Result);',
    "return { out_Result };",
  ]) assert.ok(r.code.includes(line), `無い: ${line}\n${r.code}`);
  assert.doesNotMatch(r.code, /page\.locator|getByLabel|data-testid/);
});

test("objects：リポジトリから作る。言語ごとの値はロケールで選び、それ以外は正規表現", () => {
  const { code, unconverted } = objectsSource(repo);
  assert.deepEqual(unconverted, []);
  assert.match(code, /import \{ defineObjects \} from "\.\.\/lib\/objects\.ts";/);
  assert.match(code, /"送る": \{ "ja-JP": \(p\) => p\.locator\("button\[aria-label=\\"送信\\"\]"\)\.first\(\), "en-US": \(p\) => p\.locator\("button\[aria-label=\\"Send\\"\]"\)\.first\(\), "\*": \(p\) => p\.locator\("button"\)\.and\(p\.getByLabel\(new RegExp\("\^\(送信\|Send\)\$"\)\)\)\.first\(\) \}/);
  assert.match(code, /urlPattern: "https:\/\/example\.test\/\*\*"/);
});

test("objects：O.アプリ.画面.要素 で引け、ロケールで locator を選ぶ。名前がぶつかれば止める", () => {
  const calls: string[] = [];
  const fake = { locator: (s: string) => { calls.push(s); return { s }; } } as never;
  const def = defineObjects({ "A B": { "画面": { url: "u", elements: { "要素 1": { "ja-JP": (p) => p.locator("ja"), "*": (p) => p.locator("any") } } } } });
  assert.equal((def(fake, "ja-JP").A_B.画面.要素_1 as unknown as { s: string }).s, "ja");
  assert.equal((def(fake, "ja").A_B.画面.要素_1 as unknown as { s: string }).s, "ja");
  assert.equal((def(fake, "en-US").A_B.画面.要素_1 as unknown as { s: string }).s, "any");
  assert.equal(def(fake).A_B.画面.$url, "u");
  assert.throws(() => defineObjects({ A: { S: { elements: { "x y": (p) => p.locator("a"), "x_y": (p) => p.locator("b") } } } }), /ぶつかる/);
});

test("リポジトリに無いターゲットは、じかに書いて一覧に出す", () => {
  const w: Workflow = { workflow: "I", body: [{ act: "NClick", name: "押す", objs: { Target: T("<webctrl tag='BUTTON' id='ok' />") } }] };
  const r = irToPlaywright(w, undefined);
  assert.match(r.code, /await page\.locator\("button\[id=\\"ok\\"\]"\)\.first\(\)\.click\(\);/);
  assert.match(r.unconverted.map((u) => u.why).join("\n"), /リポジトリに無いセレクター/);
  assert.doesNotMatch(r.code, /import objects/);
});

test("XAML にして読み戻した IR からも、同じ Playwright になる", () => {
  const cat = loadCatalog(repoRoot, CATALOG_FILES);
  // リポジトリを使わない形（XAML にセレクターをじかに持つ）で比べる
  const inline: Workflow = JSON.parse(JSON.stringify(wf), (k, v) => {
    if (v && typeof v === "object" && Array.isArray(v.$ref)) {
      const [, , el] = v.$ref;
      return el ? repo.apps[0].screens![0].elements!.find((e) => e.name === el)!.target : repo.apps[0].screens![0].target;
    }
    return v;
  });
  const back = importXaml(generate(inline, cat), cat);
  assert.deepEqual(back.errors ?? [], []);
  assert.equal(irToPlaywright(back.wf!, undefined).code, irToPlaywright(inline, undefined).code);
});

test("変換できないものは一覧に出し、スクリプトにコメントを残す", () => {
  const bad: Workflow = {
    workflow: "Bad",
    body: [
      { act: "NClick", name: "メモ帳", objs: { Target: T("<wnd app='notepad.exe' /><ctrl role='editable text' />") } },
      { act: "NClick", name: "画像", objs: { Target: { SearchSteps: "Image" } } },
      { act: "NClick", name: "アンカー付き", objs: { Target: { ...T("<webctrl tag='BUTTON' id='ok' />"), Anchors: [{ FullSelectorArgument: { lit: "<webctrl tag='LABEL' />" } }] } } },
      { act: "NClick", name: "式のセレクター", objs: { Target: { FullSelectorArgument: '"<webctrl id=\'" & x & "\' />"', SearchSteps: "Selector" } } },
      { act: "NHover", name: "マウスを乗せる", objs: { Target: T("<webctrl tag='A' />") } },
      { act: "LogMessage", props: { Level: "Info", Message: "DateTime.Now.ToString" } },
      { act: "NClick", name: "リポジトリ", objs: { Target: { $ref: "アプリ/画面/無い要素" } as never } },
    ],
  };
  const r = irToPlaywright(bad, { apps: [] } as Repository);
  const whys = r.unconverted.map((u) => `${u.what}: ${u.why}`).join("\n");
  for (const re of [/メモ帳: .*Web の要素ではない/, /画像: .*画像・CV/, /アンカー付き: アンカーは使わない/, /式のセレクター: .*リテラルではない/, /NHover は Playwright に直す表が無い/, /DateTime/, /無い要素/]) assert.match(whys, re);
  assert.match(r.code, /\/\/ 変換できない: NHover/);
  assert.match(r.code, /page\.locator\("button\[id=\\"ok\\"\]"\)\.first\(\)\.click\(\)/); // アンカーを捨ててセレクターで押す
});

test("Check State の「出た」「出ない」の枠（slots.IfExists / IfNotExists）を if / else にする", () => {
  const w: Workflow = { workflow: "S", body: [{ act: "NCheckState", objs: { Target: T("<webctrl id='x' />") }, props: { Mode: "WaitDisappear", Timeout: "3" },
    slots: { IfExists: [{ act: "LogMessage", props: { Level: "Info", Message: { lit: "消えた" } } }], IfNotExists: [{ act: "LogMessage", props: { Level: "Warn", Message: { lit: "残った" } } }] } }] };
  const r = irToPlaywright(w, undefined);
  assert.deepEqual(r.unconverted.filter((u) => !/リポジトリに無い/.test(u.why)), []);
  assert.match(r.code, /const __exists = await waitState\(page\.locator\("\[id=\\"x\\"\]"\)\.first\(\), "hidden", 3000\);\n\s+if \(__exists\) \{\n\s+log\("Info", "消えた"\);\n\s+\} else \{\n\s+log\("Warn", "残った"\);/);
});

test("Delay：TimeSpan.FromSeconds などの式と hh:mm:ss", () => {
  const w: Workflow = { workflow: "D", body: [
    { act: "Delay", props: { Duration: "TimeSpan.FromSeconds(5)" } },
    { act: "Delay", props: { Duration: { cs: "TimeSpan.FromMilliseconds(250)" } } },
    { act: "Delay", props: { Duration: { lit: "00:01:30" } } },
    { act: "Delay", props: { Duration: "TimeSpan.Parse(x)" } },
  ] };
  const r = irToPlaywright(w, undefined);
  assert.match(r.code, /waitForTimeout\(5000\);[\s\S]*waitForTimeout\(250\);[\s\S]*waitForTimeout\(90000\);/);
  assert.equal(r.unconverted.length, 1);
});

// 言語で表示が変わる小さなページ（navigator.language で切り替える）
const page = `<!doctype html><html><body><script>
const ja = navigator.language.startsWith("ja");
document.documentElement.lang = ja ? "ja" : "en";
document.body.innerHTML = '<input name="q"><button aria-label="' + (ja ? "検索する" : "Search") + '">go</button><div id="out"></div>'
  + '<div id="banner"><button aria-label="' + (ja ? "閉じる" : "Close") + '" onclick="this.parentNode.remove()">x</button></div>';
document.querySelector("button").onclick = () => { setTimeout(() => { document.getElementById("out").innerHTML = '<span data-testid="res">' + (ja ? "結果: " : "Result: ") + document.querySelector("input").value + '</span>'; }, 300); };
</script></body></html>`;

test("往復：objects で名前を付けて記録 → IR と repository.json → pw/objects と Playwright → 動かすと記録と同じ結果", async (t) => {
  const dir = mkdtempSync(join(tmpdir(), "ir-to-pw-"));
  try {
    const file = join(dir, "page.html");
    writeFileSync(file, page);
    const url = pathToFileURL(file).href;
    // 記録の前に、要素を objects に定義する（台本は名前で指す）
    const objects = defineObjects({ "テスト": { "ページ": { url, elements: {
      "バナーを閉じる": (p) => p.locator("#banner button"),
      "検索欄": (p) => p.locator("input"),
      "検索": (p) => p.locator("button").first(),
      "結果": (p) => p.getByTestId("res"),
    } } } });
    const recs = [];
    const results: Record<string, string> = {};
    for (const locale of ["ja-JP", "en-US"]) {
      let env;
      try { env = await launch(locale); } catch (e) { t.skip(`Chrome を起動できない: ${(e as Error).message.split("\n")[0]}`); return; }
      try {
        const P = objects(env.page, locale).テスト.ページ;
        const rec = new UiRecorder(env.page, locale);
        await rec.goto(P, { urlArg: "in_Url" });
        await rec.clickIfVisible(P.バナーを閉じる, 2000);
        await rec.fill(P.検索欄, "ir", { valueArg: "in_Q" });
        await rec.click(P.検索);
        await rec.waitVisible(P.結果);
        results[locale] = await rec.text(P.結果, "out_Result");
        recs.push(rec.recording());
      } finally { await env.browser.close(); }
    }
    const res = convert(recs, { workflow: "Search", app: "使わない", browser: "Chrome" });
    assert.deepEqual(res.warnings.filter((w) => /じかに/.test(w)), []);
    assert.equal((res.app as { name: string }).name, "テスト"); // アプリの名前は objects から
    // UiPath のプロジェクトの形に置いて、pw/objects と Playwright を作る
    const P = join(dir, "P");
    mkdirSync(join(P, "ir"), { recursive: true });
    writeFileSync(join(P, "ir", "repository.json"), JSON.stringify({ apps: [res.app] }));
    buildPwObjects(P);
    const pw = irToPlaywright(res.ir as unknown as Workflow, { apps: [res.app as never] });
    assert.deepEqual(pw.unconverted, []);
    assert.doesNotMatch(pw.code, /page\.locator|getByTestId/);
    const gen = join(P, "pw", "Search.pw.ts");
    writeFileSync(gen, pw.code);
    const mod = await import(pathToFileURL(gen).href);
    for (const locale of ["ja-JP", "en-US"]) {
      const env = await launch(locale);
      try {
        const out = await mod.Search(env.page, { in_Url: url, in_Q: "ir" }, locale);
        assert.deepEqual(out, { out_Result: results[locale] });
      } finally { await env.browser.close(); }
    }
    assert.deepEqual(results, { "ja-JP": "結果: ir", "en-US": "Result: ir" });
  } finally {
    // node_modules は tools/pw へのつなぎ（ジャンクション）。中を消さないように、先につなぎだけを外す
    const nm = join(dir, "P", "pw", "node_modules");
    if (existsSync(nm)) unlinkSync(nm);
    rmSync(dir, { recursive: true, force: true });
  }
});
