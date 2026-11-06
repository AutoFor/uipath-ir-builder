using System;
using System.Collections.Generic;
using System.Data;
using System.IO;
using System.Linq;
using UiPath.CodedWorkflows;
using UiPath.Platform.ResourceHandling;
using UiPath.Excel;
using UiPath.Excel.Activities.API;
using UiPath.Excel.Activities.API.Models;

namespace CatalogProbeNet8
{
    // tools/ir/gen-coded.ts で IR（ExcelApplicationScope_Existing）から生成。手で直さず IR を直す
    public class ExcelApplicationScope_Existing : CodedWorkflow
    {
        [Workflow]
        public void Execute()
        {
            String v = default;
            // ExcelApplicationScope は中に Coded API の無いアクティビティがあり、それだけをスコープの外に出せないので XAML 経由（coded/_xaml/ExcelApplicationScope_Existing_1.xaml）
            var __xaml2 = RunWorkflow("coded/_xaml/ExcelApplicationScope_Existing_1.xaml", new Dictionary<string, object> { ["v"] = v });
            v = (String)__xaml2["v"];
            Log(message: "A3: " + v, level: UiPath.CodedWorkflows.LogLevel.Info);
        }
    }
}
