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
    // tools/ir/gen-coded.ts で IR（ExcelReadColumn_Min）から生成。手で直さず IR を直す
    public class ExcelReadColumn_Min : CodedWorkflow
    {
        [Workflow]
        public void Execute()
        {
            IEnumerable<Object> col = default;
            using (var ExcelWorkbookScope = excel.UseWorkBook(options: new WorkbookOptions { Path = "data\\excel\\Sample.xlsx", CreateNew = true }))
            {
                col = ExcelWorkbookScope.ReadColumn(sheetName: "Sheet1", startingCell: "A1", preserveFormat: false);
            }
            Log(message: "件数: " + col.Count().ToString(), level: UiPath.CodedWorkflows.LogLevel.Info);
            Log(message: "列: " + String.Join(",", col), level: UiPath.CodedWorkflows.LogLevel.Info);
        }
    }
}
