using System;
using System.Collections.Generic;
using System.Diagnostics;
using System.Linq;
using UiPath.CodedWorkflows;

namespace __NAMESPACE__
{
    // tools/ir/templates/Steps.cs から生成。手で直さず、テンプレートを直す（gen-coded.ts が上書きする）
    //
    // ログの書き方を1つにそろえる部品（knowledge/coded-output.md「ログの書き方」）。生成したコードも手で書いたコードも、これを通して出す。
    //   1行の形：[場所] 本文
    //     場所 … ワークフローをまたいだ道すじ（Workflow / Section で積む）＋ ワークフローの中の場所（生成器が渡す）。長いときは真ん中を … で省く
    //   レベル：
    //     Info  … ワークフロー・まとまり（Section）の始めと終わり、業務のデータ、dry-run で止めた書き込み
    //     Trace … 1つ1つの操作（Op）・呼び出し（Call）の始めと終わり、細かい途中の値
    //     Warn  … 中身を持たない操作（Op）が SlowSeconds 秒以上かかった、途中で止まった（Ok を呼ぶ前に抜けた）
    //   終わりの行には、かかった秒数を必ず付ける（…終わり（n.n秒））。Ok() を呼ばずに抜けたら …中断（n.n秒）
    public static class Steps
    {
        public const double SlowSeconds = 10;  // これ以上かかった操作の「…終わり」は Warn
        public const int PlaceDepth = 3;  // 場所に出す、内側の名前の数（それより外は … にまとめる。外側は始め・終わりの行で分かる）

        private static readonly object gate = new object();
        private static readonly List<string> crumbs = new List<string>();  // ワークフローをまたいだ道すじ（RunWorkflow で呼んだ先にも続く）
        private static readonly Stack<Action<string, LogLevel>> loggers = new Stack<Action<string, LogLevel>>();

        public enum Kind { Workflow, Section, Op, Call }

        // ワークフローの始め。Execute の先頭で using var w = Steps.Workflow((m, l) => Log(m, l), "名前"); とし、最後に w.Ok() を呼ぶ
        // （Log は CodedWorkflow の protected なので、ワークフローから渡してもらう）
        public static Scope Workflow(Action<string, LogLevel> log, string name)
        {
            lock (gate) loggers.Push(log);
            return new Scope(Kind.Workflow, "", name, push: true, popLogger: true);
        }

        // まとまり（段階・ログイン全体・月次推移の取得など）。Info で始めと終わり。中の行の場所に名前が入る。遅くても Warn にしない（中の合計なので）
        public static Scope Section(string name) => new Scope(Kind.Section, "", name, push: true, popLogger: false);

        // 場所だけを積む（始め・終わりは出さない）。画面を開いたあとの本体など
        public static Scope At(string name) => new Scope(Kind.Section, "", name, push: true, popLogger: false, quiet: true);

        // 1つの操作（クリック・入力・待機など）。Trace で始めと終わり。SlowSeconds 秒以上なら終わりは Warn。inner はワークフローの中の場所（生成器が渡す）
        public static Scope Op(string inner, string name) => new Scope(Kind.Op, inner, name, push: false, popLogger: false);

        // ワークフローの呼び出し。Trace で始めと終わり。遅くても Warn にしない（呼んだ先の合計なので）。
        // 呼び先が Coded（.cs）なら、呼んだ先が Workflow で始め・終わりを出すので、ここでは出さない（同じことを2回出さない）。XAML は出す
        public static Scope Call(string inner, string name) => new Scope(Kind.Call, inner, name, push: false, popLogger: false, quiet: name.Contains(".cs'"));

        public static void Info(string message) => Write("", message, LogLevel.Info);
        public static void Trace(string message) => Write("", message, LogLevel.Trace);
        public static void Warn(string message) => Write("", message, LogLevel.Warn);
        public static void Error(string message) => Write("", message, LogLevel.Error);
        // 生成器が LogMessage から出す（inner はワークフローの中の場所）
        public static void Log(string inner, string message, LogLevel level) => Write(inner, message, level);

        // dry-run で止めた書き込み（いつも同じ形）
        public static void DryRun(string what) => Write("", $"（dry-run）書き込まない：{what}", LogLevel.Info);

        // 値の書き方をそろえる
        public static string Yen(decimal? v) => v.HasValue ? $"{v.Value:#,0}円" : "（なし）";  // int なども受ける（double は持たない。int で呼ぶとあいまいになるので）
        public static string Date(DateTime d) => d.ToString("yyyy/MM/dd");
        public static string Count(int n, string unit = "件") => $"{n}{unit}";

        public static string Place(string inner = "")
        {
            List<string> all;
            lock (gate) all = new List<string>(crumbs);
            if (!string.IsNullOrEmpty(inner)) all.AddRange(inner.Split(" > "));
            if (all.Count == 0) return "";  // 一番外（場所が無い）は [] を付けない
            if (all.Count > PlaceDepth) all = new[] { "…" }.Concat(all.Skip(all.Count - PlaceDepth)).ToList();
            return "[" + string.Join(" > ", all) + "] ";
        }

        private static void Write(string inner, string message, LogLevel level)
        {
            Action<string, LogLevel> log;
            lock (gate) log = loggers.Count > 0 ? loggers.Peek() : null;
            string line = $"{Place(inner)}{message}";
            if (log != null) log(line, level);
            else Console.WriteLine($"{level}: {line}");
        }

        public sealed class Scope : IDisposable
        {
            private readonly Kind kind;
            private readonly string inner;
            private readonly string name;
            private readonly bool push, popLogger, quiet;
            private readonly Stopwatch watch = Stopwatch.StartNew();
            private bool ok, disposed;

            internal Scope(Kind kind, string inner, string name, bool push, bool popLogger, bool quiet = false)
            {
                this.kind = kind; this.inner = inner; this.name = name; this.push = push; this.popLogger = popLogger; this.quiet = quiet;
                if (!quiet) Write(inner, $"{name} …始め", StartLevel);
                if (push) lock (gate) crumbs.Add(name);
            }

            private LogLevel StartLevel => kind == Kind.Workflow || kind == Kind.Section ? LogLevel.Info : LogLevel.Trace;

            public double Seconds => watch.Elapsed.TotalSeconds;

            // うまく終わった。結果の要約（例：「6件」）を付けられる
            public void Ok(string result = null)
            {
                if (ok || disposed) return;
                ok = true;
                watch.Stop();
                if (push) Pop();
                if (!quiet)
                {
                    var level = kind == Kind.Op && Seconds >= SlowSeconds ? LogLevel.Warn : StartLevel;
                    Write(inner, $"{name} …終わり（{Seconds:0.0}秒）{(string.IsNullOrEmpty(result) ? "" : "：" + result)}", level);
                }
                if (popLogger) lock (gate) if (loggers.Count > 0) loggers.Pop();
            }

            public void Dispose()
            {
                if (disposed) return;
                if (!ok)
                {
                    watch.Stop();
                    if (push) Pop();
                    if (!quiet) Write(inner, $"{name} …中断（{Seconds:0.0}秒）", LogLevel.Warn);
                    if (popLogger) lock (gate) if (loggers.Count > 0) loggers.Pop();
                }
                disposed = true;
            }

            private void Pop()
            {
                lock (gate)
                {
                    int i = crumbs.LastIndexOf(name);
                    if (i >= 0) crumbs.RemoveRange(i, crumbs.Count - i);
                }
            }
        }
    }
}
