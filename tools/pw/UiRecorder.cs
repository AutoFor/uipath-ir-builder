// Playwright（C#）で画面を操作しながら、操作した要素の属性を記録する（AUT-1219）。
// 記録（JSON）は tools/pw/record-to-ir.ts で IR と <P>/ir/repository.json にする。
//
// 使い方（Playwright のスクリプトにこのファイルを足す）:
//   var rec = new UiRecorder(page, "ja-JP");
//   await rec.GotoAsync("Studio Web", "https://cloud.uipath.com/...", urlArg: "in_Url");
//   await rec.ClickAsync("Studio Web", "Run ボタン", page.Locator("[data-cy=run-btn]"));
//   await rec.FillAsync("アプリ", "入力欄", page.GetByRole(AriaRole.Textbox), "ir", valueArg: "in_Text");
//   var t = await rec.TextAsync("アプリ", "ラベル", page.Locator("mat-label"), outVar: "label");
//   rec.Save("record.ja.json");
//
// - 画面の名前（screen）と要素の名前（name）は、オブジェクトリポジトリの画面と要素の名前になる
// - 日本語と英語の画面で、同じスクリプトを 1 回ずつ流す（BrowserNewContextOptions.Locale = "ja-JP" / "en-US"）。
//   record-to-ir.ts は 2 つの記録を手順の順番で突き合わせる
// - Playwright にしか無い操作（page.Route、page.EvaluateAsync など）を使ったら、Unsupported で記録に残す。
//   変換できないものとして一覧に出る（黙って捨てない）
using System;
using System.Collections.Generic;
using System.IO;
using System.Text.Json;
using System.Text.Json.Nodes;
using System.Threading.Tasks;
using Microsoft.Playwright;

public sealed class UiRecorder
{
    private readonly IPage _page;
    private readonly JsonArray _steps = new();
    private readonly string _locale;

    // 要素の属性・テキスト・CSS のパス・祖先・候補ごとの一致数を取る
    private const string SnapshotJs = @"(el) => {
  const attrs = {};
  for (const a of el.attributes) attrs[a.name] = a.value;
  const norm = (s) => (s || '').trim().replace(/\s+/g, ' ');
  const text = norm(el.innerText || el.textContent).slice(0, 200);
  const cssPath = (e) => {
    const p = [];
    while (e && e.nodeType === 1 && e !== document.documentElement) {
      let s = e.tagName.toLowerCase();
      if (e.id) { p.unshift(s + '#' + CSS.escape(e.id)); break; }
      const parent = e.parentElement;
      if (parent) {
        const sib = [...parent.children].filter((c) => c.tagName === e.tagName);
        if (sib.length > 1) s += ':nth-of-type(' + (sib.indexOf(e) + 1) + ')';
      }
      p.unshift(s);
      e = parent;
    }
    return p.join(' > ');
  };
  const ancestors = [];
  let a = el.parentElement;
  for (let i = 0; a && i < 4; i++, a = a.parentElement) {
    const x = { tag: a.tagName };
    for (const n of ['id', 'data-testid', 'data-cy', 'data-e2e', 'data-test', 'role', 'aria-label']) if (a.getAttribute(n)) x[n] = a.getAttribute(n);
    ancestors.push(x);
  }
  const root = el.getRootNode();
  const q = (sel) => { try { return root.querySelectorAll(sel).length; } catch { return -1; } };
  const tag = el.tagName.toLowerCase();
  const counts = {};
  for (const [k, v] of Object.entries(attrs)) {
    if (k === 'style' || k === 'class' || v.length > 200) continue;
    counts[k] = q(tag + '[' + CSS.escape(k) + '=""' + v.replace(/\\/g, '\\\\').replace(/""/g, '\\""') + '""]');
  }
  if (attrs['class']) counts['class'] = q(tag + '[class=""' + attrs['class'].replace(/""/g, '\\""') + '""]');
  counts['#text'] = text ? [...root.querySelectorAll(tag)].filter((x) => norm(x.innerText || x.textContent).slice(0, 200) === text).length : -1;
  counts['#tag'] = q(tag);
  return {
    tag: el.tagName, attrs, text, value: ('value' in el) ? String(el.value ?? '') : null,
    role: el.getAttribute('role'), css: cssPath(el), ancestors, counts,
    inShadow: root instanceof ShadowRoot, inFrame: window !== window.top,
  };
}";

    public UiRecorder(IPage page, string locale)
    {
        _page = page;
        _locale = locale;
    }

    public async Task GotoAsync(string screen, string url, string? urlArg = null)
    {
        await _page.GotoAsync(url);
        var step = await NewStepAsync("goto", screen, null);
        step["url"] = url;
        if (urlArg != null) step["urlArg"] = urlArg;
    }

    public async Task ClickAsync(string screen, string name, ILocator target)
    {
        await target.WaitForAsync(new LocatorWaitForOptions { State = WaitForSelectorState.Visible });
        var step = await NewStepAsync("click", screen, name, target);
        await target.ClickAsync();
        step["urlAfter"] = _page.Url;
    }

    public async Task FillAsync(string screen, string name, ILocator target, string value, string? valueArg = null)
    {
        await target.WaitForAsync(new LocatorWaitForOptions { State = WaitForSelectorState.Visible });
        var step = await NewStepAsync("fill", screen, name, target);
        step["value"] = value;
        if (valueArg != null) step["valueArg"] = valueArg;
        await target.FillAsync(value);
    }

    public async Task<string> TextAsync(string screen, string name, ILocator target, string outVar)
    {
        await target.WaitForAsync(new LocatorWaitForOptions { State = WaitForSelectorState.Visible });
        var step = await NewStepAsync("text", screen, name, target);
        var text = (await target.InnerTextAsync()).Trim();
        step["outVar"] = outVar;
        step["result"] = text;
        return text;
    }

    // 要素が出るまで待つ（UiPath では Check State の「出るまで待つ」）
    public async Task WaitVisibleAsync(string screen, string name, ILocator target, float timeoutMs = 30000)
    {
        await target.WaitForAsync(new LocatorWaitForOptions { State = WaitForSelectorState.Visible, Timeout = timeoutMs });
        var step = await NewStepAsync("wait", screen, name, target);
        step["timeoutMs"] = timeoutMs;
    }

    // Playwright にしか無い操作を使ったことを残す（変換できないものの一覧に出る）
    public void Unsupported(string what, string detail)
    {
        _steps.Add(new JsonObject { ["i"] = _steps.Count, ["action"] = "unsupported", ["what"] = what, ["detail"] = detail });
    }

    public void Save(string path)
    {
        var doc = new JsonObject
        {
            ["version"] = 1,
            ["locale"] = _locale,
            ["browser"] = _page.Context.Browser?.BrowserType.Name,
            ["browserVersion"] = _page.Context.Browser?.Version,
            ["recordedAt"] = DateTime.UtcNow.ToString("o"),
            ["steps"] = _steps,
        };
        var dir = Path.GetDirectoryName(Path.GetFullPath(path));
        if (!string.IsNullOrEmpty(dir)) Directory.CreateDirectory(dir);
        File.WriteAllText(path, doc.ToJsonString(new JsonSerializerOptions { WriteIndented = true, Encoder = System.Text.Encodings.Web.JavaScriptEncoder.UnsafeRelaxedJsonEscaping }));
    }

    private async Task<JsonObject> NewStepAsync(string action, string screen, string? name, ILocator? target = null)
    {
        var step = new JsonObject
        {
            ["i"] = _steps.Count,
            ["action"] = action,
            ["screen"] = screen,
            ["page"] = new JsonObject
            {
                ["url"] = _page.Url,
                ["title"] = await _page.TitleAsync(),
                ["lang"] = await _page.EvaluateAsync<string>("() => document.documentElement.lang || ''"),
            },
        };
        if (name != null) step["name"] = name;
        if (target != null)
        {
            var count = await target.CountAsync();
            var snap = await target.First.EvaluateAsync<JsonElement>(SnapshotJs);
            var el = JsonNode.Parse(snap.GetRawText())!.AsObject();
            el["locatorCount"] = count;
            step["element"] = el;
        }
        _steps.Add(step);
        return step;
    }
}
