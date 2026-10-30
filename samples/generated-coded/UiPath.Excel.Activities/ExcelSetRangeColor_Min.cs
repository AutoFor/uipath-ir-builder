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
    // tools/ir/gen-coded.ts で IR（ExcelSetRangeColor_Min）から生成。手で直さず IR を直す
    public class ExcelSetRangeColor_Min : CodedWorkflow
    {
        [Workflow]
        public void Execute()
        {
            System.Drawing.Color c = default;
            // 元のブックを output に写す
            system.CopyFile(path: "data\\excel\\Sample.xlsx", destination: "output\\ExcelSetRangeColor_Min.xlsx", overwrite: true);
            using (var ExcelWorkbookScope = excel.UseWorkBook(options: new WorkbookOptions { Path = "output\\ExcelSetRangeColor_Min.xlsx", CreateNew = true }))
            {
                ExcelWorkbookScope.SetRangeColor(sheetName: "Sheet1", range: "B2:B3", color: System.Drawing.Color.Yellow);
                c = ExcelWorkbookScope.GetCellColor(sheetName: "Sheet1", cell: "B3");
            }
            Log(message: "RGB=" + c.R.ToString() + "," + c.G.ToString() + "," + c.B.ToString(), level: UiPath.CodedWorkflows.LogLevel.Info);
        }
    }
}
