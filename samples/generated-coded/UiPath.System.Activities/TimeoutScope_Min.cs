using System;
using System.Collections.Generic;
using System.Data;
using System.IO;
using System.Linq;
using UiPath.CodedWorkflows;
using UiPath.Platform.ResourceHandling;

namespace CatalogProbeNet8
{
    // tools/ir/gen-coded.ts で IR（TimeoutScope_Min）から生成。手で直さず IR を直す
    public class TimeoutScope_Min : CodedWorkflow
    {
        [Workflow]
        public void Execute()
        {
            // TimeoutScope はCoded API が無い（Coded API なし（時間切れで中の処理を打ち切って例外にする API が無い。Task と CancellationToken で自分で組むことになり、同じ意味の機械的な変換にならない））ので XAML 経由（coded/_xaml/TimeoutScope_Min_1.xaml）
            RunWorkflow("coded/_xaml/TimeoutScope_Min_1.xaml", null);
            Log(message: "スコープの後", level: UiPath.CodedWorkflows.LogLevel.Info);
        }
    }
}
