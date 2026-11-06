using System;
using System.Collections.Generic;
using System.Data;
using System.IO;
using System.Linq;
using UiPath.CodedWorkflows;
using UiPath.Platform.ResourceHandling;

namespace CatalogProbeNet8
{
    // tools/ir/gen-coded.ts で IR（EnableTrigger_Min）から生成。手で直さず IR を直す
    public class EnableTrigger_Min : CodedWorkflow
    {
        [Workflow]
        public void Execute()
        {
            // EnableTrigger はCoded API が無い（Coded API なし（トリガーは ISystemService に無い））ので XAML 経由（coded/_activities/EnableTrigger_8b952c.xaml）
            RunWorkflow("coded/_activities/EnableTrigger_8b952c.xaml", null);
            Log(message: "切り替えた", level: UiPath.CodedWorkflows.LogLevel.Info);
        }
    }
}
