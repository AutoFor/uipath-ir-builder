using System;
using System.Collections.Generic;
using System.Data;
using System.IO;
using System.Linq;
using UiPath.CodedWorkflows;
using UiPath.Platform.ResourceHandling;

namespace CatalogProbeNet8
{
    // tools/ir/gen-coded.ts で IR（TimeTrigger_Min）から生成。手で直さず IR を直す
    public class TimeTrigger_Min : CodedWorkflow
    {
        [Workflow]
        public void Execute()
        {
            // TimeTrigger はCoded API が無い（Coded API なし（トリガーは ISystemService に無い））ので XAML 経由（coded/_xaml/TimeTrigger_Min_1.xaml）
            RunWorkflow("coded/_xaml/TimeTrigger_Min_1.xaml", null);
            Log(message: "時刻で開始した", level: UiPath.CodedWorkflows.LogLevel.Info);
        }
    }
}
