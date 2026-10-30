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
    // tools/ir/gen-coded.ts で IR（ReadRangeX_Full）から生成。手で直さず IR を直す
    public class ReadRangeX_Full : CodedWorkflow
    {
        [Workflow]
        public void Execute()
        {
            DataTable dt = default;
            using (var Excel = excel.UseExcelFile(options: new UseOptions { Path = "data\\excel\\Sample.xlsx", SaveChanges = true, CreateIfNotExist = true, ReadOnly = true }))
            {
                // 表を読む
                dt = Excel.Sheet["Sheet1"].Range["A1:C4"].ReadRange(hasHeaders: true, readFormattingOptions: UiPath.Excel.ReadFormattingOptions.DisplayValue, visibleRowsOnly: false);
            }
            Log(message: "列数: " + dt.Columns.Count.ToString(), level: UiPath.CodedWorkflows.LogLevel.Info);
            Log(message: "3行目: " + dt.Rows[2]["Name"].ToString() + " " + dt.Rows[2]["Double"].ToString(), level: UiPath.CodedWorkflows.LogLevel.Info);
        }
    }
}
