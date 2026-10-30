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
    // tools/ir/gen-coded.ts で IR（ExcelWriteRange_Full）から生成。手で直さず IR を直す
    public class ExcelWriteRange_Full : CodedWorkflow
    {
        [Workflow]
        public void Execute()
        {
            DataTable dt = default;
            DataTable back = default;
            using (var ExcelWorkbookScope = excel.UseWorkBook(options: new WorkbookOptions { Path = "data\\excel\\Sample.xlsx", CreateNew = true }))
            {
                dt = ExcelWorkbookScope.ReadRange(sheetName: "Sheet1", range: "A1:B4", addHeaders: true, preserveFormat: false);
            }
            using (var ExcelWorkbookScope = excel.UseWorkBook(options: new WorkbookOptions { Path = "output\\ExcelWriteRange_Full.xlsx", CreateNew = true }))
            {
                // C3 から見出し付きで書く
                ExcelWorkbookScope.WriteRange(sheetName: "Sheet1", startingCell: "C3", table: dt, addHeaders: true);
                back = ExcelWorkbookScope.ReadRange(sheetName: "Sheet1", range: "C3:D6", addHeaders: true, preserveFormat: false);
            }
            Log(message: "書いた行数: " + back.Rows.Count.ToString(), level: UiPath.CodedWorkflows.LogLevel.Info);
            Log(message: "見出し: " + back.Columns[0].ColumnName + "," + back.Columns[1].ColumnName, level: UiPath.CodedWorkflows.LogLevel.Info);
            Log(message: "最後の行: " + back.Rows[2][0].ToString() + " " + back.Rows[2][1].ToString(), level: UiPath.CodedWorkflows.LogLevel.Info);
        }
    }
}
