using System;
using System.Collections.Generic;
using System.Data;
using System.IO;
using System.Linq;
using UiPath.CodedWorkflows;
using UiPath.Platform.ResourceHandling;

namespace CatalogProbeNet8
{
    // tools/ir/gen-coded.ts で IR（StartTimer_Full）から生成。手で直さず IR を直す
    public class StartTimer_Full : CodedWorkflow
    {
        [Workflow]
        public void Execute()
        {
            Timer t1 = default;
            Timer t2 = default;
            // 1つ目
            // StartTimer はCoded API が無い（Coded API なし（UiPath.Core.Timer を作る・測る API が無い））ので XAML 経由（coded/_xaml/StartTimer_Full_1.xaml）
            var __xaml1 = RunWorkflow("coded/_xaml/StartTimer_Full_1.xaml", new Dictionary<string, object> { ["t1"] = t1 });
            t1 = (Timer)__xaml1["t1"];
            // 2つ目
            // StartTimer はCoded API が無い（Coded API なし（UiPath.Core.Timer を作る・測る API が無い））ので XAML 経由（coded/_xaml/StartTimer_Full_2.xaml）
            var __xaml2 = RunWorkflow("coded/_xaml/StartTimer_Full_2.xaml", new Dictionary<string, object> { ["t2"] = t2 });
            t2 = (Timer)__xaml2["t2"];
            Log(message: "別のタイマー: " + (!Object.ReferenceEquals(t1, t2)).ToString(), level: UiPath.CodedWorkflows.LogLevel.Info);
        }
    }
}
