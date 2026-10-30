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
    // tools/ir/gen-coded.ts で IR（ExcelApplicationScope_Full）から生成。手で直さず IR を直す
    public class ExcelApplicationScope_Full : CodedWorkflow
    {
        [Workflow]
        public void Execute()
        {
            String v = default;
            WorkbookApplication wb = default;
            using (var ExcelWorkbookScope = excel.UseWorkBook(options: new WorkbookOptions { Path = "data\\excel\\Sample.xlsx", CreateNew = false }))
            {
                v = (String)Convert.ChangeType(ExcelWorkbookScope.ReadCell(sheetName: "Sheet2", cell: "A1", preserveFormat: false), typeof(String));
            }
            Log(message: "Sheet2!A1: " + v, level: UiPath.CodedWorkflows.LogLevel.Info);
        }
    }
}
