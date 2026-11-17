using System;
using System.Collections.Generic;
using System.Data;
using System.IO;
using System.Linq;
using UiPath.CodedWorkflows;
using UiPath.Platform.ResourceHandling;

namespace CatalogProbeNet8
{
    // tools/ir/gen-coded.ts で IR（Flowchart_Full）から生成。手で直さず IR を直す
    public class Flowchart_Full : CodedWorkflow
    {
        [Workflow]
        public void Execute()
        {
            Int32 total = 0;
            // 数える
            // Flowchart は対応表が無いので XAML 経由（coded/_xaml/Flowchart_Full_1.xaml）
            var __xaml1 = RunWorkflow("coded/_xaml/Flowchart_Full_1.xaml", new Dictionary<string, object> { ["total"] = total });
            total = (Int32)__xaml1["total"];
            Log(message: "total=" + total.ToString(), level: UiPath.CodedWorkflows.LogLevel.Info);
        }
    }
}
