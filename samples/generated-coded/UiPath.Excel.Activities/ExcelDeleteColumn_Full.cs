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
    // tools/ir/gen-coded.ts で IR（ExcelDeleteColumn_Full）から生成。手で直さず IR を直す
    public class ExcelDeleteColumn_Full : CodedWorkflow
    {
        [Workflow]
        public void Execute()
        {
            DataTable dt = default;
            // 元のブックを output に写す
            system.CopyFile(path: "data\\excel\\Sample.xlsx", destination: "output\\ExcelDeleteColumn_Full.xlsx", overwrite: true);
            // ExcelApplicationScope は中に Coded API の無いアクティビティがあり、それだけをスコープの外に出せないので XAML 経由（coded/_xaml/ExcelDeleteColumn_Full_1.xaml）
            var __xaml1 = RunWorkflow("coded/_xaml/ExcelDeleteColumn_Full_1.xaml", new Dictionary<string, object> { ["dt"] = dt });
            dt = (DataTable)__xaml1["dt"];
            Log(message: "見出し0: " + dt.Columns[0].ColumnName, level: UiPath.CodedWorkflows.LogLevel.Info);
            Log(message: "見出し1: " + dt.Columns[1].ColumnName, level: UiPath.CodedWorkflows.LogLevel.Info);
            Log(message: "見出し2: " + dt.Columns[2].ColumnName, level: UiPath.CodedWorkflows.LogLevel.Info);
        }
    }
}
