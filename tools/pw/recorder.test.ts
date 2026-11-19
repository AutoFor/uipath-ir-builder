import { strict as assert } from "node:assert";
import { test } from "node:test";
import { convert } from "./record-to-ir.ts";
import { launch, UiRecorder } from "./recorder.ts";

// 言語ごとに表示の文字が変わる小さなページ（data-testid・作られた id・aria-label・文字だけ、の要素）
const html = (ja: boolean) => `<!doctype html><html lang="${ja ? "ja" : "en"}"><body>
  <input id="mat-input-3" name="q" aria-label="${ja ? "検索" : "Search"}">
  <button data-testid="run-btn" onclick="document.getElementById('out').textContent='${ja ? "完了" : "Done"}'">${ja ? "実行" : "Run"}</button>
  <div id="out"></div>
  <button aria-label="${ja ? "閉じる" : "Close"}">x</button>
  <span>${ja ? "ようこそ" : "Welcome"}</span>
</body></html>`;

test("Chrome で操作を記録し、2 言語の記録から IR にする", async (t) => {
  let env;
  try { env = await launch("ja-JP"); } catch (e) { t.skip(`Chrome を起動できない: ${(e as Error).message.split("\n")[0]}`); return; }
  const { browser, page } = env;
  try {
    const recs = [];
    for (const ja of [true, false]) {
      await page.setContent(html(ja));
      const rec = new UiRecorder(page, ja ? "ja-JP" : "en-US");
      await rec.fill("画面", "検索欄", page.locator("input"), "ir", { valueArg: "in_Q" });
      await rec.click("画面", "実行", page.getByTestId("run-btn"));
      assert.equal(await rec.text("画面", "結果", page.locator("#out"), "out_Result"), ja ? "完了" : "Done");
      await rec.waitVisible("画面", "閉じる", page.locator("button[aria-label]"));
      await rec.waitVisible("画面", "あいさつ", page.locator("span"));
      rec.unsupported("page.route", "画像を止める");
      recs.push(rec.recording());
    }
    const el = recs[0].steps[0].element!;
    assert.equal(el.tag, "INPUT");
    assert.equal(el.counts["name"], 1);
    const res = convert(recs, { workflow: "T", app: "テスト", browser: "Chrome" });
    const sel = Object.fromEntries(res.choices.map((c) => [c.name, c.choice.selector]));
    assert.equal(sel["検索欄"], "<webctrl tag='INPUT' name='q' />"); // 作られた id は使わない
    assert.equal(sel["実行"], "<webctrl tag='BUTTON' data-testid='run-btn' />");
    assert.equal(sel["結果"], "<webctrl tag='DIV' id='out' />");
    assert.equal(sel["閉じる"], "<webctrl tag='BUTTON' aria-label='^(閉じる|Close)$' matching:aria-label='regex' />");
    assert.equal(sel["あいさつ"], "<webctrl tag='SPAN' innertext='^(ようこそ|Welcome)$' matching:innertext='regex' />"); // 文字だけの要素は 2 言語の正規表現
    assert.equal(res.unconverted.length, 1);
  } finally {
    await browser.close();
  }
});
