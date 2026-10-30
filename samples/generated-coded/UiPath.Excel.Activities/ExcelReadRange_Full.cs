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
    // tools/ir/gen-coded.ts で IR（ExcelReadRange_Full）から生成。手で直さず IR を直す
    public class ExcelReadRange_Full : CodedWorkflow
    {
        [Workflow]
        public void Execute()
        {
            DataTable dt = default;
            using (var ExcelWorkbookScope = excel.UseWorkBook(options: new WorkbookOptions { Path = "data\\excel\\Sample.xlsx", CreateNew = true }))
            {
                // 見出しなしで読む
                dt = ExcelWorkbookScope.ReadRange(sheetName: "Sheet1", range: "A2:B4", addHeaders: false, preserveFormat: true);
            }
            Log(message: "行数: " + dt.Rows.Count.ToString(), level: UiPath.CodedWorkflows.LogLevel.Info);
            Log(message: "1 行目: " + dt.Rows[0][0].ToString() + " " + dt.Rows[0][1].ToString(), level: UiPath.CodedWorkflows.LogLevel.Info);
        }
    }
}
