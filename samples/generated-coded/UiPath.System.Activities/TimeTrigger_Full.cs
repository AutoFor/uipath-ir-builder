using System;
using System.Collections.Generic;
using System.Data;
using System.IO;
using System.Linq;
using UiPath.CodedWorkflows;
using UiPath.Platform.ResourceHandling;

namespace CatalogProbeNet8
{
    // tools/ir/gen-coded.ts で IR（TimeTrigger_Full）から生成。手で直さず IR を直す
    public class TimeTrigger_Full : CodedWorkflow
    {
        [Workflow]
        public void Execute()
        {
            UiPath.Core.Activities.CurrentJobInfo ji = default;
            // 時刻トリガー
            // TimeTrigger はCoded API が無い（Coded API なし（トリガーは ISystemService に無い））ので XAML 経由（coded/_xaml/TimeTrigger_Full_1.xaml）
            var __xaml1 = RunWorkflow("coded/_xaml/TimeTrigger_Full_1.xaml", new Dictionary<string, object> { ["ji"] = ji });
            ji = (UiPath.Core.Activities.CurrentJobInfo)__xaml1["ji"];
            Log(message: "時刻で開始した", level: UiPath.CodedWorkflows.LogLevel.Info);
        }
    }
}
