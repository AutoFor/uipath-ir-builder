using System;
using System.Collections.Generic;
using System.Data;
using System.IO;
using System.Linq;
using UiPath.CodedWorkflows;
using UiPath.Platform.ResourceHandling;

namespace CatalogProbeNet8
{
    // tools/ir/gen-coded.ts で IR（QueueTrigger_Min）から生成。手で直さず IR を直す
    public class QueueTrigger_Min : CodedWorkflow
    {
        [Workflow]
        public void Execute()
        {
            // QueueTrigger はCoded API が無い（Coded API なし（トリガーは ISystemService に無い））ので XAML 経由（coded/_activities/QueueTrigger_89d7e5.xaml）
            RunWorkflow("coded/_activities/QueueTrigger_89d7e5.xaml", null);
            Log(message: "キューで開始した", level: UiPath.CodedWorkflows.LogLevel.Info);
        }
    }
}
