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
    // tools/ir/gen-coded.ts で IR（ExcelReadCellFormula_Min）から生成。手で直さず IR を直す
    public class ExcelReadCellFormula_Min : CodedWorkflow
    {
        [Workflow]
        public void Execute()
        {
            String f = default;
            using (var ExcelWorkbookScope = excel.UseWorkBook(options: new WorkbookOptions { Path = "data\\excel\\Sample.xlsx", CreateNew = true }))
            {
                f = ExcelWorkbookScope.ReadCellFormula(sheetName: "Sheet1", cell: "C2");
            }
            Log(message: "C2 の式: " + f, level: UiPath.CodedWorkflows.LogLevel.Info);
        }
    }
}
