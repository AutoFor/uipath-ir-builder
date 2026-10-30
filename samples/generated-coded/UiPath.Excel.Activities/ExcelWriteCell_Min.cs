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
    // tools/ir/gen-coded.ts で IR（ExcelWriteCell_Min）から生成。手で直さず IR を直す
    public class ExcelWriteCell_Min : CodedWorkflow
    {
        [Workflow]
        public void Execute()
        {
            String v = default;
            // 元のブックを output に写す
            system.CopyFile(path: "data\\excel\\Sample.xlsx", destination: "output\\ExcelWriteCell_Min.xlsx", overwrite: true);
            using (var ExcelWorkbookScope = excel.UseWorkBook(options: new WorkbookOptions { Path = "output\\ExcelWriteCell_Min.xlsx", CreateNew = true }))
            {
                ExcelWorkbookScope.WriteCell(sheetName: "Sheet1", cell: "E1", text: "済");
                v = (String)Convert.ChangeType(ExcelWorkbookScope.ReadCell(sheetName: "Sheet1", cell: "E1", preserveFormat: false), typeof(String));
            }
            Log(message: "E1: " + v, level: UiPath.CodedWorkflows.LogLevel.Info);
        }
    }
}
