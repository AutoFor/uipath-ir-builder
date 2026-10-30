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
    // tools/ir/gen-coded.ts で IR（ExcelSetRangeColor_Full）から生成。手で直さず IR を直す
    public class ExcelSetRangeColor_Full : CodedWorkflow
    {
        [Workflow]
        public void Execute()
        {
            System.Drawing.Color c = default;
            // 元のブックを output に写す
            system.CopyFile(path: "data\\excel\\Sample.xlsx", destination: "output\\ExcelSetRangeColor_Full.xlsx", overwrite: true);
            using (var ExcelWorkbookScope = excel.UseWorkBook(options: new WorkbookOptions { Path = "output\\ExcelSetRangeColor_Full.xlsx", CreateNew = true }))
            {
                // Sheet2 の A1 に色を付ける
                ExcelWorkbookScope.SetRangeColor(sheetName: "Sheet2", range: "A1", color: System.Drawing.Color.FromArgb(0, 128, 255));
                c = ExcelWorkbookScope.GetCellColor(sheetName: "Sheet2", cell: "A1");
            }
            Log(message: "RGB=" + c.R.ToString() + "," + c.G.ToString() + "," + c.B.ToString(), level: UiPath.CodedWorkflows.LogLevel.Info);
        }
    }
}
