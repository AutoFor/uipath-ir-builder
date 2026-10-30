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
    // tools/ir/gen-coded.ts で IR（ExcelReadCell_Full）から生成。手で直さず IR を直す
    public class ExcelReadCell_Full : CodedWorkflow
    {
        [Workflow]
        public void Execute()
        {
            Object v = default;
            using (var ExcelWorkbookScope = excel.UseWorkBook(options: new WorkbookOptions { Path = "data\\excel\\Sample.xlsx", CreateNew = true }))
            {
                // 式の結果を読む
                v = (Object)Convert.ChangeType(ExcelWorkbookScope.ReadCell(sheetName: "Sheet1", cell: "C4", preserveFormat: true), typeof(Object));
            }
            Log(message: "C4: " + v.ToString(), level: UiPath.CodedWorkflows.LogLevel.Info);
        }
    }
}
