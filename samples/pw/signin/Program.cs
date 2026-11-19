// UiPath のサインイン画面を操作し、要素の属性を記録する（AUT-1219 の題材）。
// 使い方: dotnet run -- <ロケール> <記録の出力先>   例: dotnet run -- ja-JP rec/signin.ja.json
// パスワードは入れない。メール欄には example.com の仮のアドレスを入れるだけで、送らない。
using Microsoft.Playwright;
var locale = args.Length > 0 ? args[0] : "ja-JP";
var output = args.Length > 1 ? args[1] : $"rec/signin.{locale[..2]}.json";
using var pw = await Playwright.CreateAsync();
await using var browser = await pw.Chromium.LaunchAsync(new() { Channel = "chrome", Headless = true });
var ctx = await browser.NewContextAsync(new() { Locale = locale });
var page = await ctx.NewPageAsync();
var rec = new UiRecorder(page, locale);
const string S = "サインイン";
await rec.GotoAsync(S, "https://cloud.uipath.com/", urlArg: "in_Url");
await rec.WaitVisibleAsync(S, "メールで続ける", page.Locator("[data-cy=authorize-with-email]"));
// Cookie のバナーは、出る・出ないがブラウザーのプロファイルで変わる。記録では閉じず、変換できないものとして残す
rec.Unsupported("Cookie のバナー", "OneTrust のバナーは、出るかどうかがブラウザーの状態で変わる。UiPath では、出たときだけ閉じる手順（Check App State）を人が足す");
await rec.ClickAsync(S, "メールで続ける", page.Locator("[data-cy=authorize-with-email]"));
await rec.FillAsync(S, "メール欄", page.Locator("[data-cy=login-email-input]"), "user@example.com", valueArg: "in_Email");
await rec.TextAsync(S, "サインアップへのリンク", page.Locator("[data-cy=login-goto-signup]"), outVar: "out_SignUp");
await rec.TextAsync(S, "言語の選択", page.Locator("[data-cy=language-select]"), outVar: "out_Language");
await rec.WaitVisibleAsync(S, "サインインボタン", page.Locator("[data-cy=login-button]"));
rec.Save(output);
Console.WriteLine($"記録した: {output}");
