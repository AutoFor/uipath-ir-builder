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
    // tools/ir/gen-coded.ts で IR（ExcelReadRange_Min）から生成。手で直さず IR を直す
    public class ExcelReadRange_Min : CodedWorkflow
    {
        [Workflow]
        public void Execute()
        {
            DataTable dt = default;
            using (var ExcelWorkbookScope = excel.UseWorkBook(options: new WorkbookOptions { Path = "data\\excel\\Sample.xlsx", CreateNew = true }))
            {
                dt = ExcelWorkbookScope.ReadRange(sheetName: "Sheet1", range: "A1:C4", addHeaders: true, preserveFormat: false);
            }
            Log(message: "行数: " + dt.Rows.Count.ToString(), level: UiPath.CodedWorkflows.LogLevel.Info);
            Log(message: "2 行目: " + dt.Rows[1]["Name"].ToString() + " " + dt.Rows[1]["Age"].ToString(), level: UiPath.CodedWorkflows.LogLevel.Info);
        }
    }
}
