using System;
using System.Collections.Generic;
using System.Data;
using System.IO;
using System.Linq;
using UiPath.CodedWorkflows;
using UiPath.Platform.ResourceHandling;

namespace CatalogProbeNet8
{
    // tools/ir/gen-coded.ts で IR（ManualTrigger_Full）から生成。手で直さず IR を直す
    public class ManualTrigger_Full : CodedWorkflow
    {
        [Workflow]
        public void Execute()
        {
            CurrentJobInfo ji = default;
            // 手動トリガー
            // ManualTrigger はCoded API が無い（Coded API なし（トリガーは ISystemService に無い））ので XAML 経由（coded/_xaml/ManualTrigger_Full_1.xaml）
            var __xaml1 = RunWorkflow("coded/_xaml/ManualTrigger_Full_1.xaml", new Dictionary<string, object> { ["ji"] = ji });
            ji = (CurrentJobInfo)__xaml1["ji"];
            Log(message: "手動で開始した", level: UiPath.CodedWorkflows.LogLevel.Info);
        }
    }
}
