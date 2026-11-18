using System;
using System.IO;
using System.Linq;
using Microsoft.Playwright;
using UiPath.CodedWorkflows;

namespace PwServerlessProbe
{
    // Playwright（C#）でロボットの Chrome を動かせるかを確かめる試作。
    // 公開ページを開いてタイトルを読み、ログに出して返すだけ。
    public class Main : CodedWorkflow
    {
        [Workflow]
        public (string out_Title, string out_Info) Execute(string in_Url, bool in_Headless)
        {
            if (string.IsNullOrEmpty(in_Url)) in_Url = "https://example.com/";

            // どこから Playwright と driver を読もうとしているかを残す（落ちたときの手がかり）
            var asmDir = Path.GetDirectoryName(typeof(IPlaywright).Assembly.Location) ?? "";
            var driverDir = Path.Combine(asmDir, ".playwright");
            Log($"Playwright の DLL: {typeof(IPlaywright).Assembly.Location}");
            Log($".playwright の有無: {Directory.Exists(driverDir)} ({driverDir})");
            if (Directory.Exists(driverDir))
                Log("driver の中身: " + string.Join(", ", Directory.GetFileSystemEntries(driverDir, "*", SearchOption.TopDirectoryOnly).Select(Path.GetFileName)));
            Log($"OS: {Environment.OSVersion}, 64bit: {Environment.Is64BitProcess}, user: {Environment.UserName}, interactive: {Environment.UserInteractive}");

            // ロボットは NuGet のキャッシュの lib/ から DLL を読む。driver は同じパッケージの根元の .playwright にある
            var pkgRoot = Path.GetFullPath(Path.Combine(asmDir, "..", ".."));
            var pkgDriver = Path.Combine(pkgRoot, ".playwright");
            Log($"パッケージの根元の .playwright: {Directory.Exists(pkgDriver)} ({pkgDriver})");
            if (!Directory.Exists(driverDir) && Directory.Exists(pkgDriver))
            {
                Environment.SetEnvironmentVariable("PLAYWRIGHT_DRIVER_SEARCH_PATH", pkgRoot);
                Log("PLAYWRIGHT_DRIVER_SEARCH_PATH = " + pkgRoot);
                var nodeDir = Path.Combine(pkgDriver, "node");
                if (Directory.Exists(nodeDir))
                    Log("node の種類: " + string.Join(", ", Directory.GetDirectories(nodeDir).Select(Path.GetFileName)));
                // NuGet の展開では実行の権限が付かない（Linux）。node に付ける
                if (!OperatingSystem.IsWindows() && Directory.Exists(nodeDir))
                {
                    foreach (var f in Directory.GetFiles(nodeDir, "node", SearchOption.AllDirectories))
                    {
                        try
                        {
                            File.SetUnixFileMode(f, File.GetUnixFileMode(f) | UnixFileMode.UserExecute | UnixFileMode.GroupExecute | UnixFileMode.OtherExecute);
                            Log("実行の権限を付けた: " + f);
                        }
                        catch (Exception ex) { Log("権限を付けられない: " + f + " " + ex.Message); }
                    }
                }
            }
            var browsers = new[] { "/usr/bin/google-chrome", "/usr/bin/google-chrome-stable", "/opt/google/chrome/chrome", "/usr/bin/chromium", "/usr/bin/chromium-browser",
                Environment.ExpandEnvironmentVariables(@"%ProgramFiles%\Google\Chrome\Application\chrome.exe"),
                Environment.ExpandEnvironmentVariables(@"%ProgramFiles(x86)%\Google\Chrome\Application\chrome.exe"),
                Environment.ExpandEnvironmentVariables(@"%ProgramFiles(x86)%\Microsoft\Edge\Application\msedge.exe") };
            Log("ブラウザーの候補: " + string.Join(", ", browsers.Select(b => b + "=" + File.Exists(b))));

            // node が動くかを先に確かめる（driver は node + package/cli.js）
            var plat = OperatingSystem.IsWindows() ? "win32_x64" : "linux-x64";
            var nodeExe = Path.Combine(pkgDriver, "node", plat, OperatingSystem.IsWindows() ? "node.exe" : "node");
            Log("node --version: " + RunQuick(nodeExe, "--version"));
            Log("cli.js --version: " + RunQuick(nodeExe, "\"" + Path.Combine(pkgDriver, "package", "cli.js") + "\" --version"));
            if (File.Exists("/proc/mounts"))
                Log("/tmp のマウント: " + string.Join(" | ", File.ReadAllLines("/proc/mounts").Where(l => l.Contains(" /tmp") || l.Contains(" / "))));

            var createTask = Playwright.CreateAsync();
            if (!createTask.Wait(TimeSpan.FromSeconds(90))) throw new TimeoutException("Playwright.CreateAsync が 90 秒で終わらない（driver と話せない）");
            using var pw = createTask.Result;
            Log("Playwright の driver が起動した");

            var opts = new BrowserTypeLaunchOptions { Headless = in_Headless, Channel = "chrome" };
            IBrowser browser;
            try
            {
                browser = pw.Chromium.LaunchAsync(opts).GetAwaiter().GetResult();
                Log("Chrome を Channel=chrome で起動した");
            }
            catch (Exception ex)
            {
                Log("Channel=chrome で起動できない: " + ex.Message.Split('\n')[0]);
                var exe = new[]
                {
                    Environment.ExpandEnvironmentVariables(@"%ProgramFiles%\Google\Chrome\Application\chrome.exe"),
                    Environment.ExpandEnvironmentVariables(@"%ProgramFiles(x86)%\Google\Chrome\Application\chrome.exe"),
                    Environment.ExpandEnvironmentVariables(@"%LocalAppData%\Google\Chrome\Application\chrome.exe"),
                    "/usr/bin/google-chrome",
                    "/opt/google/chrome/chrome",
                    "/usr/bin/chromium",
                }.FirstOrDefault(File.Exists);
                if (exe == null) throw;
                Log("ExecutablePath で起動する: " + exe);
                browser = pw.Chromium.LaunchAsync(new BrowserTypeLaunchOptions { Headless = in_Headless, ExecutablePath = exe }).GetAwaiter().GetResult();
            }

            var page = browser.NewPageAsync().GetAwaiter().GetResult();
            page.GotoAsync(in_Url).GetAwaiter().GetResult();
            var title = page.TitleAsync().GetAwaiter().GetResult();
            var info = $"headless={in_Headless}, browser={browser.BrowserType.Name} {browser.Version}";
            Log($"タイトル: {title}（{info}）");
            browser.CloseAsync().GetAwaiter().GetResult();
            return (title, info);
        }

        // 外のプログラムを 30 秒まで動かし、出力を返す
        private static string RunQuick(string exe, string args)
        {
            try
            {
                var psi = new System.Diagnostics.ProcessStartInfo(exe, args) { RedirectStandardOutput = true, RedirectStandardError = true, UseShellExecute = false };
                using var p = System.Diagnostics.Process.Start(psi)!;
                var o = p.StandardOutput.ReadToEndAsync(); var e = p.StandardError.ReadToEndAsync();
                if (!p.WaitForExit(30000)) { p.Kill(true); return "30 秒で終わらない"; }
                return $"exit={p.ExitCode} out={o.Result.Trim()} err={e.Result.Trim()}";
            }
            catch (Exception ex) { return "起動できない: " + ex.Message; }
        }
    }
}
