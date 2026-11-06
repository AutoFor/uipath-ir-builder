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
    // tools/ir/gen-coded.ts で IR（ExcelRemoveDuplicatesRange_Min）から生成。手で直さず IR を直す
    public class ExcelRemoveDuplicatesRange_Min : CodedWorkflow
    {
        [Workflow]
        public void Execute()
        {
            DataTable dt = default;
            // ExcelApplicationScope は中に Coded API の無いアクティビティがあり、それだけをスコープの外に出せないので XAML 経由（coded/_xaml/ExcelRemoveDuplicatesRange_Min_1.xaml）
            var __xaml1 = RunWorkflow("coded/_xaml/ExcelRemoveDuplicatesRange_Min_1.xaml", new Dictionary<string, object> { ["dt"] = dt });
            dt = (DataTable)__xaml1["dt"];
            Log(message: "行数: " + dt.Rows.Count.ToString(), level: UiPath.CodedWorkflows.LogLevel.Info);
            Log(message: "1 行目: " + dt.Rows[0][0].ToString(), level: UiPath.CodedWorkflows.LogLevel.Info);
            Log(message: "2 行目: " + dt.Rows[1][0].ToString(), level: UiPath.CodedWorkflows.LogLevel.Info);
            Log(message: "3 行目: " + dt.Rows[2][0].ToString(), level: UiPath.CodedWorkflows.LogLevel.Info);
        }
    }
}
