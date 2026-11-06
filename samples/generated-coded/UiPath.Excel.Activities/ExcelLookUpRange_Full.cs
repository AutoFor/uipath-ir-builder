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
    // tools/ir/gen-coded.ts で IR（ExcelLookUpRange_Full）から生成。手で直さず IR を直す
    public class ExcelLookUpRange_Full : CodedWorkflow
    {
        [Workflow]
        public void Execute()
        {
            Object v = default;
            Object w = default;
            // ExcelApplicationScope は中に Coded API の無いアクティビティがあり、それだけをスコープの外に出せないので XAML 経由（coded/_xaml/ExcelLookUpRange_Full_1.xaml）
            var __xaml2 = RunWorkflow("coded/_xaml/ExcelLookUpRange_Full_1.xaml", new Dictionary<string, object> { ["v"] = v });
            v = (Object)__xaml2["v"];
            Log(message: "結果: " + Convert.ToString(v), level: UiPath.CodedWorkflows.LogLevel.Info);
        }
    }
}
