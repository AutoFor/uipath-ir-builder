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
    // tools/ir/gen-coded.ts で IR（ExcelGetCellColor_Min）から生成。手で直さず IR を直す
    public class ExcelGetCellColor_Min : CodedWorkflow
    {
        [Workflow]
        public void Execute()
        {
            System.Drawing.Color c = default;
            using (var ExcelWorkbookScope = excel.UseWorkBook(options: new WorkbookOptions { Path = "data\\excel\\Sample.xlsx", CreateNew = true }))
            {
                c = ExcelWorkbookScope.GetCellColor(sheetName: "Sheet1", cell: "A1");
            }
            Log(message: "RGB=" + c.R.ToString() + "," + c.G.ToString() + "," + c.B.ToString(), level: UiPath.CodedWorkflows.LogLevel.Info);
        }
    }
}
