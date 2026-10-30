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
    // tools/ir/gen-coded.ts で IR（ExcelAppendRange_Full）から生成。手で直さず IR を直す
    public class ExcelAppendRange_Full : CodedWorkflow
    {
        [Workflow]
        public void Execute()
        {
            DataTable dt = default;
            DataTable back = default;
            // 元のブックを output に写す
            system.CopyFile(path: "data\\excel\\Sample.xlsx", destination: "output\\ExcelAppendRange_Full.xlsx", overwrite: true);
            using (var ExcelWorkbookScope = excel.UseWorkBook(options: new WorkbookOptions { Path = "output\\ExcelAppendRange_Full.xlsx", CreateNew = true }))
            {
                dt = ExcelWorkbookScope.ReadRange(sheetName: "Sheet1", range: "A1:C4", addHeaders: true, preserveFormat: false);
                // Sheet2 の末尾に足す
                ExcelWorkbookScope.AppendRange(sheetName: "Sheet2", table: dt);
                back = ExcelWorkbookScope.ReadRange(sheetName: "Sheet2", range: "A1:C8", addHeaders: true, preserveFormat: false);
            }
            Log(message: "行数: " + back.Rows.Count.ToString(), level: UiPath.CodedWorkflows.LogLevel.Info);
            Log(message: "最後の行: " + back.Rows[back.Rows.Count - 1][0].ToString(), level: UiPath.CodedWorkflows.LogLevel.Info);
        }
    }
}
