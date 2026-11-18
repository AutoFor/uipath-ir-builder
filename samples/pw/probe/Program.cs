// ページの DOM を見るだけ（記録はしない）。使い方: dotnet run -- <URL> <ロケール>
using Microsoft.Playwright;
var url = args.Length > 0 ? args[0] : "https://cloud.uipath.com/";
var locale = args.Length > 1 ? args[1] : "ja-JP";
using var pw = await Playwright.CreateAsync();
await using var browser = await pw.Chromium.LaunchAsync(new() { Channel = "chrome", Headless = true });
var ctx = await browser.NewContextAsync(new() { Locale = locale });
var page = await ctx.NewPageAsync();
await page.GotoAsync(url, new() { WaitUntil = WaitUntilState.NetworkIdle });
Console.WriteLine($"URL: {page.Url}");
Console.WriteLine($"タイトル: {await page.TitleAsync()}");
var js = @"() => [...document.querySelectorAll('button, a, input, h1, h2, [role=button], [data-testid], [data-cy]')].slice(0, 60).map(e => {
  const at = [...e.attributes].filter(a => /^(id|name|type|role|aria-label|placeholder|data-[\w-]+|href)$/.test(a.name)).map(a => a.name + '=' + JSON.stringify(a.value.slice(0, 60))).join(' ');
  return e.tagName + ' ' + at + ' | ' + (e.innerText || e.value || '').trim().replace(/\s+/g, ' ').slice(0, 50);
}).join('\n')";
Console.WriteLine(await page.EvaluateAsync<string>(js));
