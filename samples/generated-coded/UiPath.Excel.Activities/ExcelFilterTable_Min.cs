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
    // tools/ir/gen-coded.ts で IR（ExcelFilterTable_Min）から生成。手で直さず IR を直す
    public class ExcelFilterTable_Min : CodedWorkflow
    {
        [Workflow]
        public void Execute()
        {
            DataTable dt = default;
            // 元のブックを output に写す
            system.CopyFile(path: "data\\excel\\Sample.xlsx", destination: "output\\ExcelFilterTable_Min.xlsx", overwrite: true);
            // ExcelApplicationScope は中に Coded API の無いアクティビティがあり、それだけをスコープの外に出せないので XAML 経由（coded/_xaml/ExcelFilterTable_Min_1.xaml）
            var __xaml1 = RunWorkflow("coded/_xaml/ExcelFilterTable_Min_1.xaml", new Dictionary<string, object> { ["dt"] = dt });
            dt = (DataTable)__xaml1["dt"];
            Log(message: "行数: " + dt.Rows.Count.ToString(), level: UiPath.CodedWorkflows.LogLevel.Info);
            Log(message: "1 行目: " + dt.Rows[0]["Name"].ToString(), level: UiPath.CodedWorkflows.LogLevel.Info);
        }
    }
}
