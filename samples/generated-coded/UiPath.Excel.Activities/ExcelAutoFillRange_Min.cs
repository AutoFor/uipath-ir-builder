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
    // tools/ir/gen-coded.ts で IR（ExcelAutoFillRange_Min）から生成。手で直さず IR を直す
    public class ExcelAutoFillRange_Min : CodedWorkflow
    {
        [Workflow]
        public void Execute()
        {
            Object v = default;
            Object w = default;
            // 元のブックを output に写す
            system.CopyFile(path: "data\\excel\\Sample.xlsx", destination: "output\\ExcelAutoFillRange_Min.xlsx", overwrite: true);
            // ExcelApplicationScope は中に Coded API の無いアクティビティがあり、それだけをスコープの外に出せないので XAML 経由（coded/_xaml/ExcelAutoFillRange_Min_1.xaml）
            var __xaml1 = RunWorkflow("coded/_xaml/ExcelAutoFillRange_Min_1.xaml", new Dictionary<string, object> { ["v"] = v });
            v = (Object)__xaml1["v"];
            Log(message: "E5: " + Convert.ToString(v), level: UiPath.CodedWorkflows.LogLevel.Info);
        }
    }
}
