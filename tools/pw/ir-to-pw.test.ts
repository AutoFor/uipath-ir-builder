import { strict as assert } from "node:assert";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, relative } from "node:path";
import { test } from "node:test";
import { fileURLToPath, pathToFileURL } from "node:url";
import { loadCatalog } from "../ir/catalog.ts";
import { generate } from "../ir/generate.ts";
import { CATALOG_FILES, importXaml, repoRoot } from "../ir/import-xaml.ts";
import type { Repository } from "../ir/objrepo.ts";
import type { Workflow } from "../ir/types.ts";
import { irToPlaywright } from "./ir-to-pw.ts";
import { convert } from "./record-to-ir.ts";
import { launch, UiRecorder } from "./recorder.ts";

const here = dirname(fileURLToPath(import.meta.url));
const opt = { runtimeImport: "./runtime.ts" };
const T = (sel: string) => ({ FullSelectorArgument: { lit: sel }, SearchSteps: "Selector" });

// 画面操作の IR（ターゲットはリポジトリを使わずに書く）
const wf: Workflow = {
  workflow: "Form",
  arguments: [{ name: "in_Name", dir: "In", type: "String" }, { name: "out_Result", dir: "Out", type: "String" }],
  variables: [{ name: "found", type: "Boolean" }],
  body: [{
    act: "NApplicationCard", name: "フォームを開く",
    objs: { TargetApp: { BrowserType: "Chrome", Selector: { lit: "<html app='chrome.exe' url='https://example.test/*' />" }, Url: { lit: "https://example.test/form" } } },
    props: { OpenMode: "Always", CloseMode: "Always" },
    body: [
      { act: "NTypeInto", name: "名前", objs: { Target: T("<webctrl tag='INPUT' name='name' />") }, props: { Text: "in_Name" } },
      { act: "NClick", name: "送る", objs: { Target: T("<webctrl tag='BUTTON' aria-label='^(送信|Send)$' matching:aria-label='regex' />") } },
      { act: "NCheckState", name: "結果を待つ", objs: { Target: T("<webctrl tag='DIV' data-testid='result' />") }, props: { Mode: "WaitAppear", Timeout: "10", Exists: "found" } },
      { act: "If", props: { Condition: "Not found" }, then: [{ act: "Throw", props: { Exception: 'New Exception("結果が出ない")' } }] },
      { act: "NGetText", name: "結果", objs: { Target: T("<webctrl tag='DIV' data-testid='result' />") }, props: { TextString: "out_Result" } },
      { act: "LogMessage", props: { Level: "Info", Message: '"結果: " & out_Result' } },
    ],
  }],
};

test("IR の画面操作を Playwright にする", () => {
  const r = irToPlaywright(wf, undefined, opt);
  assert.deepEqual(r.unconverted, []);
  for (const line of [
    'await page.goto("https://example.test/form");',
    'await page.waitForURL("https://example.test/**");',
    'await page.locator("input[name=\\"name\\"]").first().fill(in_Name);',
    'await page.locator("button").and(page.getByLabel(new RegExp("^(送信|Send)$"))).first().click();',
    'found = await waitState(page.locator("div[data-testid=\\"result\\"]").first(), "visible", 10000);',
    "if (!found) {",
    'throw new Error("結果が出ない");',
    'out_Result = await getText(page.locator("div[data-testid=\\"result\\"]").first());',
    'log("Info", "結果: " + out_Result);',
    "return { out_Result };",
  ]) assert.ok(r.code.includes(line), `無い: ${line}\n${r.code}`);
});

test("XAML にして読み戻した IR からも、同じ Playwright になる", () => {
  const cat = loadCatalog(repoRoot, CATALOG_FILES);
  const back = importXaml(generate(wf, cat), cat);
  assert.deepEqual(back.errors ?? [], []);
  assert.equal(irToPlaywright(back.wf, undefined, opt).code, irToPlaywright(wf, undefined, opt).code);
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
  const r = irToPlaywright(bad, { apps: [] } as Repository, opt);
  const whys = r.unconverted.map((u) => `${u.what}: ${u.why}`).join("\n");
  for (const re of [/メモ帳: .*Web の要素ではない/, /画像: .*画像・CV/, /アンカー付き: アンカーは使わない/, /式のセレクター: .*リテラルではない/, /NHover は Playwright に直す表が無い/, /DateTime/, /無い要素/]) assert.match(whys, re);
  assert.match(r.code, /\/\/ 変換できない: NHover/);
  assert.match(r.code, /page\.locator\("button\[id=\\"ok\\"\]"\)\.first\(\)\.click\(\)/); // アンカーを捨ててセレクターで押す
});

// 言語で表示が変わる小さなページ（navigator.language で切り替える）
const page = `<!doctype html><html><body><script>
const ja = navigator.language.startsWith("ja");
document.documentElement.lang = ja ? "ja" : "en";
document.body.innerHTML = '<input name="q"><button aria-label="' + (ja ? "検索する" : "Search") + '">go</button><div id="out"></div>'
  + '<div id="banner"><button aria-label="' + (ja ? "閉じる" : "Close") + '" onclick="this.parentNode.remove()">x</button></div>';
document.querySelector("button").onclick = () => { setTimeout(() => { document.getElementById("out").innerHTML = '<span data-testid="res">' + (ja ? "結果: " : "Result: ") + document.querySelector("input").value + '</span>'; }, 300); };
</script></body></html>`;

test("往復：Chrome で記録 → IR → Playwright を生成して動かすと、記録と同じ結果になる", async (t) => {
  const dir = mkdtempSync(join(tmpdir(), "ir-to-pw-"));
  try {
    const file = join(dir, "page.html");
    writeFileSync(file, page);
    const url = pathToFileURL(file).href;
    const recs = [];
    const results: Record<string, string> = {};
    for (const locale of ["ja-JP", "en-US"]) {
      let env;
      try { env = await launch(locale); } catch (e) { t.skip(`Chrome を起動できない: ${(e as Error).message.split("\n")[0]}`); return; }
      try {
        const rec = new UiRecorder(env.page, locale);
        await rec.goto("ページ", url, { urlArg: "in_Url" });
        await rec.clickIfVisible("ページ", "バナーを閉じる", env.page.locator("#banner button"), 2000);
        await rec.fill("ページ", "検索欄", env.page.locator("input"), "ir", { valueArg: "in_Q" });
        await rec.click("ページ", "検索", env.page.locator("button").first());
        await rec.waitVisible("ページ", "結果", env.page.getByTestId("res"));
        results[locale] = await rec.text("ページ", "結果", env.page.getByTestId("res"), "out_Result");
        recs.push(rec.recording());
      } finally { await env.browser.close(); }
    }
    const res = convert(recs, { workflow: "Search", app: "テスト", browser: "Chrome" });
    const repo: Repository = { apps: [res.app as never] };
    const runtime = relative(dir, join(here, "runtime.ts")).replace(/\\/g, "/");
    const pw = irToPlaywright(res.ir as unknown as Workflow, repo, { runtimeImport: runtime.startsWith(".") ? runtime : `./${runtime}` });
    assert.deepEqual(pw.unconverted, []);
    const gen = join(dir, "Search.pw.ts");
    writeFileSync(gen, pw.code);
    const mod = await import(pathToFileURL(gen).href);
    for (const locale of ["ja-JP", "en-US"]) {
      const env = await launch(locale);
      try {
        const out = await mod.Search(env.page, { in_Url: url, in_Q: "ir" });
        assert.deepEqual(out, { out_Result: results[locale] });
      } finally { await env.browser.close(); }
    }
    assert.deepEqual(results, { "ja-JP": "結果: ir", "en-US": "Result: ir" });
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("Check State の「出た」「出ない」の枠（slots.IfExists / IfNotExists）を if / else にする", () => {
  const w: Workflow = { workflow: "S", body: [{ act: "NCheckState", objs: { Target: T("<webctrl id='x' />") }, props: { Mode: "WaitDisappear", Timeout: "3" },
    slots: { IfExists: [{ act: "LogMessage", props: { Level: "Info", Message: { lit: "消えた" } } }], IfNotExists: [{ act: "LogMessage", props: { Level: "Warn", Message: { lit: "残った" } } }] } }] };
  const r = irToPlaywright(w, undefined, opt);
  assert.deepEqual(r.unconverted, []);
  assert.match(r.code, /const __exists = await waitState\(page\.locator\("\[id=\\"x\\"\]"\)\.first\(\), "hidden", 3000\);\n\s+if \(__exists\) \{\n\s+log\("Info", "消えた"\);\n\s+\} else \{\n\s+log\("Warn", "残った"\);/);
});

test("Delay：TimeSpan.FromSeconds などの式と hh:mm:ss", () => {
  const w: Workflow = { workflow: "D", body: [
    { act: "Delay", props: { Duration: "TimeSpan.FromSeconds(5)" } },
    { act: "Delay", props: { Duration: { cs: "TimeSpan.FromMilliseconds(250)" } } },
    { act: "Delay", props: { Duration: { lit: "00:01:30" } } },
    { act: "Delay", props: { Duration: "TimeSpan.Parse(x)" } },
  ] };
  const r = irToPlaywright(w, undefined, opt);
  assert.match(r.code, /waitForTimeout\(5000\);[\s\S]*waitForTimeout\(250\);[\s\S]*waitForTimeout\(90000\);/);
  assert.equal(r.unconverted.length, 1);
});
