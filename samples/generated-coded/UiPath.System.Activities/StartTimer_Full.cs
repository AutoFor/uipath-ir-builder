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
            // StartTimer はCoded API が無い（Coded API なし（UiPath.Core.Timer を作る・測る API が無い））ので XAML 経由（coded/_activities/StartTimer.xaml）
            var __xaml1 = RunWorkflow("coded/_activities/StartTimer.xaml", null);
            t1 = (UiPath.Core.Timer)__xaml1["out_Timer"];
            // 2つ目
            // StartTimer はCoded API が無い（Coded API なし（UiPath.Core.Timer を作る・測る API が無い））ので XAML 経由（coded/_activities/StartTimer.xaml）
            var __xaml2 = RunWorkflow("coded/_activities/StartTimer.xaml", null);
            t2 = (UiPath.Core.Timer)__xaml2["out_Timer"];
            Log(message: "別のタイマー: " + (!Object.ReferenceEquals(t1, t2)).ToString(), level: UiPath.CodedWorkflows.LogLevel.Info);
        }
    }
}
