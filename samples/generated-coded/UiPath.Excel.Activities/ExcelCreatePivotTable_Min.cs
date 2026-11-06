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
    // tools/ir/gen-coded.ts で IR（ExcelCreatePivotTable_Min）から生成。手で直さず IR を直す
    public class ExcelCreatePivotTable_Min : CodedWorkflow
    {
        [Workflow]
        public void Execute()
        {
            String r = default;
            // 元のブックを output に写す
            system.CopyFile(path: "data\\excel\\Sample.xlsx", destination: "output\\ExcelCreatePivotTable_Min.xlsx", overwrite: true);
            // ExcelApplicationScope は中に Coded API の無いアクティビティがあり、それだけをスコープの外に出せないので XAML 経由（coded/_xaml/ExcelCreatePivotTable_Min_1.xaml）
            var __xaml1 = RunWorkflow("coded/_xaml/ExcelCreatePivotTable_Min_1.xaml", new Dictionary<string, object> { ["r"] = r });
            r = (String)__xaml1["r"];
            Log(message: "ピボットの範囲: " + r, level: UiPath.CodedWorkflows.LogLevel.Info);
        }
    }
}
