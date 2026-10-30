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
    // tools/ir/gen-coded.ts で IR（ExcelReadCellFormula_Full）から生成。手で直さず IR を直す
    public class ExcelReadCellFormula_Full : CodedWorkflow
    {
        [Workflow]
        public void Execute()
        {
            String f = default;
            String plain = default;
            using (var ExcelWorkbookScope = excel.UseWorkBook(options: new WorkbookOptions { Path = "data\\excel\\Sample.xlsx", CreateNew = true }))
            {
                // 式を読む
                f = ExcelWorkbookScope.ReadCellFormula(sheetName: "Sheet1", cell: "C4");
                // 式でないセルを読む
                plain = ExcelWorkbookScope.ReadCellFormula(sheetName: "Sheet1", cell: "B4");
            }
            Log(message: "C4 の式: " + f, level: UiPath.CodedWorkflows.LogLevel.Info);
            Log(message: "B4 の式: " + plain, level: UiPath.CodedWorkflows.LogLevel.Info);
        }
    }
}
