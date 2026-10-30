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
    // tools/ir/gen-coded.ts で IR（ExcelWriteCell_Full）から生成。手で直さず IR を直す
    public class ExcelWriteCell_Full : CodedWorkflow
    {
        [Workflow]
        public void Execute()
        {
            String v = default;
            String w = default;
            // 元のブックを output に写す
            system.CopyFile(path: "data\\excel\\Sample.xlsx", destination: "output\\ExcelWriteCell_Full.xlsx", overwrite: true);
            using (var ExcelWorkbookScope = excel.UseWorkBook(options: new WorkbookOptions { Path = "output\\ExcelWriteCell_Full.xlsx", CreateNew = true }))
            {
                // 2 つ目のシートに書く
                ExcelWorkbookScope.WriteCell(sheetName: "Sheet2", cell: "B2", text: "書いた");
                ExcelWorkbookScope.WriteCell(sheetName: "Sheet1", cell: "A2", text: "上書き");
                v = (String)Convert.ChangeType(ExcelWorkbookScope.ReadCell(sheetName: "Sheet2", cell: "B2", preserveFormat: false), typeof(String));
                w = (String)Convert.ChangeType(ExcelWorkbookScope.ReadCell(sheetName: "Sheet1", cell: "A2", preserveFormat: false), typeof(String));
            }
            Log(message: "Sheet2!B2: " + v, level: UiPath.CodedWorkflows.LogLevel.Info);
            Log(message: "Sheet1!A2: " + w, level: UiPath.CodedWorkflows.LogLevel.Info);
        }
    }
}
