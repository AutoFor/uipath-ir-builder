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
    // tools/ir/gen-coded.ts で IR（ExcelReadRow_Min）から生成。手で直さず IR を直す
    public class ExcelReadRow_Min : CodedWorkflow
    {
        [Workflow]
        public void Execute()
        {
            IEnumerable<Object> row = default;
            using (var ExcelWorkbookScope = excel.UseWorkBook(options: new WorkbookOptions { Path = "data\\excel\\Sample.xlsx", CreateNew = true }))
            {
                row = ExcelWorkbookScope.ReadRow(sheetName: "Sheet1", startingCell: "A2", preserveFormat: false);
            }
            Log(message: "件数: " + row.Count().ToString(), level: UiPath.CodedWorkflows.LogLevel.Info);
            Log(message: "行: " + String.Join(",", row), level: UiPath.CodedWorkflows.LogLevel.Info);
        }
    }
}
