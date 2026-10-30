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
    // tools/ir/gen-coded.ts で IR（ExcelAppendRange_Min）から生成。手で直さず IR を直す
    public class ExcelAppendRange_Min : CodedWorkflow
    {
        [Workflow]
        public void Execute()
        {
            DataTable dt = default;
            DataTable back = default;
            // 元のブックを output に写す
            system.CopyFile(path: "data\\excel\\Sample.xlsx", destination: "output\\ExcelAppendRange_Min.xlsx", overwrite: true);
            using (var ExcelWorkbookScope = excel.UseWorkBook(options: new WorkbookOptions { Path = "output\\ExcelAppendRange_Min.xlsx", CreateNew = true }))
            {
                dt = ExcelWorkbookScope.ReadRange(sheetName: "Sheet1", range: "A2:C3", addHeaders: true, preserveFormat: false);
                ExcelWorkbookScope.AppendRange(sheetName: "Sheet1", table: dt);
                back = ExcelWorkbookScope.ReadRange(sheetName: "Sheet1", range: "A1:C8", addHeaders: true, preserveFormat: false);
            }
            Log(message: "行数: " + back.Rows.Count.ToString(), level: UiPath.CodedWorkflows.LogLevel.Info);
            Log(message: "最後の行: " + back.Rows[back.Rows.Count - 1][0].ToString(), level: UiPath.CodedWorkflows.LogLevel.Info);
        }
    }
}
