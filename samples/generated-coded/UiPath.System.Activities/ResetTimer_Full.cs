using System;
using System.Collections.Generic;
using System.Data;
using System.IO;
using System.Linq;
using UiPath.CodedWorkflows;
using UiPath.Platform.ResourceHandling;

namespace CatalogProbeNet8
{
    // tools/ir/gen-coded.ts で IR（ResetTimer_Full）から生成。手で直さず IR を直す
    public class ResetTimer_Full : CodedWorkflow
    {
        [Workflow]
        public void Execute()
        {
            Timer t = default;
            // StartTimer はCoded API が無い（Coded API なし（UiPath.Core.Timer を作る・測る API が無い））ので XAML 経由（coded/_activities/StartTimer.xaml）
            var __xaml1 = RunWorkflow("coded/_activities/StartTimer.xaml", null);
            t = (UiPath.Core.Timer)__xaml1["out_Timer"];
            Delay(time: TimeSpan.FromMilliseconds(200));
            // 動いている途中でリセット
            // ResetTimer はCoded API が無い（Coded API なし（UiPath.Core.Timer をリセットする API が無い））ので XAML 経由（coded/_activities/ResetTimer.xaml）
            RunWorkflow("coded/_activities/ResetTimer.xaml", new Dictionary<string, object> { ["in_Timer"] = t });
            Log(message: "動作中にリセットした", level: UiPath.CodedWorkflows.LogLevel.Info);
            // StopTimer はCoded API が無い（Coded API なし（UiPath.Core.Timer を止める API が無い））ので XAML 経由（coded/_activities/StopTimer.xaml）
            RunWorkflow("coded/_activities/StopTimer.xaml", new Dictionary<string, object> { ["in_Timer"] = t });
            // 止めた後でリセット
            // ResetTimer はCoded API が無い（Coded API なし（UiPath.Core.Timer をリセットする API が無い））ので XAML 経由（coded/_activities/ResetTimer.xaml）
            RunWorkflow("coded/_activities/ResetTimer.xaml", new Dictionary<string, object> { ["in_Timer"] = t });
            Log(message: "停止後にリセットした", level: UiPath.CodedWorkflows.LogLevel.Info);
        }
    }
}
