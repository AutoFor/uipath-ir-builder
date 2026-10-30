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
    // tools/ir/gen-coded.ts で IR（ExcelReadColumn_Full）から生成。手で直さず IR を直す
    public class ExcelReadColumn_Full : CodedWorkflow
    {
        [Workflow]
        public void Execute()
        {
            IEnumerable<Object> col = default;
            using (var ExcelWorkbookScope = excel.UseWorkBook(options: new WorkbookOptions { Path = "data\\excel\\Sample.xlsx", CreateNew = true }))
            {
                // 式の列を読む
                col = ExcelWorkbookScope.ReadColumn(sheetName: "Sheet1", startingCell: "C2", preserveFormat: true);
            }
            Log(message: "件数: " + col.Count().ToString(), level: UiPath.CodedWorkflows.LogLevel.Info);
            Log(message: "列: " + String.Join(",", col), level: UiPath.CodedWorkflows.LogLevel.Info);
        }
    }
}
