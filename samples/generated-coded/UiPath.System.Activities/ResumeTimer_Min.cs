using System;
using System.Collections.Generic;
using System.Data;
using System.IO;
using System.Linq;
using UiPath.CodedWorkflows;
using UiPath.Platform.ResourceHandling;

namespace CatalogProbeNet8
{
    // tools/ir/gen-coded.ts で IR（ResumeTimer_Min）から生成。手で直さず IR を直す
    public class ResumeTimer_Min : CodedWorkflow
    {
        [Workflow]
        public void Execute()
        {
            Timer t = default;
            // StartTimer はCoded API が無い（Coded API なし（UiPath.Core.Timer を作る・測る API が無い））ので XAML 経由（coded/_activities/StartTimer.xaml）
            var __xaml1 = RunWorkflow("coded/_activities/StartTimer.xaml", null);
            t = (UiPath.Core.Timer)__xaml1["out_Timer"];
            // ResumeTimer はCoded API が無い（Coded API なし（UiPath.Core.Timer を再開する API が無い））ので XAML 経由（coded/_activities/ResumeTimer.xaml）
            RunWorkflow("coded/_activities/ResumeTimer.xaml", new Dictionary<string, object> { ["in_Timer"] = t });
            Log(message: "ResumeTimer の後", level: UiPath.CodedWorkflows.LogLevel.Info);
        }
    }
}
