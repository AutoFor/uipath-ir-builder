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
    // tools/ir/gen-coded.ts で IR（ExcelReadCell_Min）から生成。手で直さず IR を直す
    public class ExcelReadCell_Min : CodedWorkflow
    {
        [Workflow]
        public void Execute()
        {
            String v = default;
            using (var ExcelWorkbookScope = excel.UseWorkBook(options: new WorkbookOptions { Path = "data\\excel\\Sample.xlsx", CreateNew = true }))
            {
                v = (String)Convert.ChangeType(ExcelWorkbookScope.ReadCell(sheetName: "Sheet1", cell: "A3", preserveFormat: false), typeof(String));
            }
            Log(message: "A3: " + v, level: UiPath.CodedWorkflows.LogLevel.Info);
        }
    }
}
