using System;
using System.Collections.Generic;
using System.Data;
using System.IO;
using System.Linq;
using UiPath.CodedWorkflows;
using UiPath.Platform.ResourceHandling;

namespace CatalogProbeNet8
{
    // tools/ir/gen-coded.ts で IR（DisableTrigger_Full）から生成。手で直さず IR を直す
    public class DisableTrigger_Full : CodedWorkflow
    {
        [Workflow]
        public void Execute()
        {
            // トリガーの範囲
            // TriggerScope はCoded API が無い（Coded API なし（トリガーは ISystemService に無い））ので XAML 経由（coded/_xaml/DisableTrigger_Full_1.xaml）
            RunWorkflow("coded/_xaml/DisableTrigger_Full_1.xaml", null);
            // DisableTrigger(全部入り)
            // DisableTrigger はCoded API が無い（Coded API なし（トリガーは ISystemService に無い））ので XAML 経由（coded/_xaml/DisableTrigger_Full_2.xaml）
            RunWorkflow("coded/_xaml/DisableTrigger_Full_2.xaml", null);
            Log(message: "切り替えた", level: UiPath.CodedWorkflows.LogLevel.Info);
        }
    }
}
