using System;
using System.Collections.Generic;
using System.Data;
using System.IO;
using System.Linq;
using UiPath.CodedWorkflows;
using UiPath.Platform.ResourceHandling;

namespace CatalogProbeNet8
{
    // tools/ir/gen-coded.ts で IR（ResumeTimer_Full）から生成。手で直さず IR を直す
    public class ResumeTimer_Full : CodedWorkflow
    {
        [Workflow]
        public void Execute()
        {
            Timer t = default;
            // StartTimer はCoded API が無い（Coded API なし（UiPath.Core.Timer を作る・測る API が無い））ので XAML 経由（coded/_xaml/ResumeTimer_Full_1.xaml）
            var __xaml1 = RunWorkflow("coded/_xaml/ResumeTimer_Full_1.xaml", new Dictionary<string, object> { ["t"] = t });
            t = (Timer)__xaml1["t"];
            // 止める
            // StopTimer はCoded API が無い（Coded API なし（UiPath.Core.Timer を止める API が無い））ので XAML 経由（coded/_xaml/ResumeTimer_Full_2.xaml）
            RunWorkflow("coded/_xaml/ResumeTimer_Full_2.xaml", new Dictionary<string, object> { ["t"] = t });
            // 再開
            // ResumeTimer はCoded API が無い（Coded API なし（UiPath.Core.Timer を再開する API が無い））ので XAML 経由（coded/_xaml/ResumeTimer_Full_3.xaml）
            RunWorkflow("coded/_xaml/ResumeTimer_Full_3.xaml", new Dictionary<string, object> { ["t"] = t });
            Log(message: "再開した", level: UiPath.CodedWorkflows.LogLevel.Info);
            // もう一度止める
            // StopTimer はCoded API が無い（Coded API なし（UiPath.Core.Timer を止める API が無い））ので XAML 経由（coded/_xaml/ResumeTimer_Full_4.xaml）
            RunWorkflow("coded/_xaml/ResumeTimer_Full_4.xaml", new Dictionary<string, object> { ["t"] = t });
            // もう一度再開
            // ResumeTimer はCoded API が無い（Coded API なし（UiPath.Core.Timer を再開する API が無い））ので XAML 経由（coded/_xaml/ResumeTimer_Full_5.xaml）
            RunWorkflow("coded/_xaml/ResumeTimer_Full_5.xaml", new Dictionary<string, object> { ["t"] = t });
            Log(message: "2回再開した", level: UiPath.CodedWorkflows.LogLevel.Info);
        }
    }
}
