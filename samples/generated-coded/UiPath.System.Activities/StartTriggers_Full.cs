using System;
using System.Collections.Generic;
using System.Data;
using System.IO;
using System.Linq;
using UiPath.CodedWorkflows;
using UiPath.Platform.ResourceHandling;

namespace CatalogProbeNet8
{
    // tools/ir/gen-coded.ts で IR（StartTriggers_Full）から生成。手で直さず IR を直す
    public class StartTriggers_Full : CodedWorkflow
    {
        [Workflow]
        public void Execute()
        {
            // トリガーを開始
            // StartTriggers はCoded API が無い（Coded API なし（トリガーは ISystemService に無い））ので XAML 経由（coded/_xaml/StartTriggers_Full_1.xaml）
            RunWorkflow("coded/_xaml/StartTriggers_Full_1.xaml", null);
            Log(message: "開始した", level: UiPath.CodedWorkflows.LogLevel.Info);
        }
    }
}
