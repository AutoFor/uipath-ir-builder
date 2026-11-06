using System;
using System.Collections.Generic;
using System.Data;
using System.IO;
using System.Linq;
using UiPath.CodedWorkflows;
using UiPath.Platform.ResourceHandling;

namespace CatalogProbeNet8
{
    // tools/ir/gen-coded.ts で IR（StopTimer_Min）から生成。手で直さず IR を直す
    public class StopTimer_Min : CodedWorkflow
    {
        [Workflow]
        public void Execute()
        {
            Timer t = default;
            // StartTimer はCoded API が無い（Coded API なし（UiPath.Core.Timer を作る・測る API が無い））ので XAML 経由（coded/_xaml/StopTimer_Min_1.xaml）
            var __xaml1 = RunWorkflow("coded/_xaml/StopTimer_Min_1.xaml", new Dictionary<string, object> { ["t"] = t });
            t = (Timer)__xaml1["t"];
            // StopTimer はCoded API が無い（Coded API なし（UiPath.Core.Timer を止める API が無い））ので XAML 経由（coded/_xaml/StopTimer_Min_2.xaml）
            RunWorkflow("coded/_xaml/StopTimer_Min_2.xaml", new Dictionary<string, object> { ["t"] = t });
            Log(message: "StopTimer の後", level: UiPath.CodedWorkflows.LogLevel.Info);
        }
    }
}
