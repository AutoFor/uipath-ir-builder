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
    // tools/ir/gen-coded.ts で IR（FilterX_Full）から生成。手で直さず IR を直す
    public class FilterX_Full : CodedWorkflow
    {
        [Workflow]
        public void Execute()
        {
            DataTable dt = default;
            // 元のブックを output に写す
            system.CopyFile(path: "data\\excel\\Sample.xlsx", destination: "output\\FilterX_Full.xlsx", overwrite: true);
            using (var Excel = excel.UseExcelFile(options: new UseOptions { Path = "output\\FilterX_Full.xlsx", SaveChanges = true, CreateIfNotExist = true }))
            {
                // 30 より大きい
                Excel.Sheet["Sheet1"].Range["A1:C4"].Filter(options: new FilterOptions { ColumnName = "Age", Filter = new AdvancedFilter { Operator = UiPath.Excel.LogicalOperator.And, Condition1 = UiPath.Excel.ExcelFilterOperator.GT, Value1 = "26", Condition2 = UiPath.Excel.ExcelFilterOperator.LT, Value2 = "40" } });
                dt = Excel.Sheet["Sheet1"].Range["A1:C4"].ReadRange(hasHeaders: true, visibleRowsOnly: true);
                Log(message: "行数: " + dt.Rows.Count.ToString(), level: UiPath.CodedWorkflows.LogLevel.Info);
                Log(message: "先頭: " + dt.Rows[0][0].ToString(), level: UiPath.CodedWorkflows.LogLevel.Info);
                // 解除
                Excel.Sheet["Sheet1"].Range["A1:C4"].Filter(options: new FilterOptions { ColumnName = "Age", ClearFilter = true });
                dt = Excel.Sheet["Sheet1"].Range["A1:C4"].ReadRange(hasHeaders: true, visibleRowsOnly: true);
                Log(message: "解除後: " + dt.Rows.Count.ToString(), level: UiPath.CodedWorkflows.LogLevel.Info);
            }
        }
    }
}
