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
    // tools/ir/gen-coded.ts で IR（ExcelCloseWorkbook_Min）から生成。手で直さず IR を直す
    public class ExcelCloseWorkbook_Min : CodedWorkflow
    {
        [Workflow]
        public void Execute()
        {
            Object v = default;
            // 元のブックを output に写す
            system.CopyFile(path: "data\\excel\\Sample.xlsx", destination: "output\\ExcelCloseWorkbook_Min.xlsx", overwrite: true);
            // ExcelApplicationScope は中に Coded API の無いアクティビティがあり、それだけをスコープの外に出せないので XAML 経由（coded/_xaml/ExcelCloseWorkbook_Min_1.xaml）
            RunWorkflow("coded/_xaml/ExcelCloseWorkbook_Min_1.xaml", null);
            using (var ExcelWorkbookScope = excel.UseWorkBook(options: new WorkbookOptions { Path = "output\\ExcelCloseWorkbook_Min.xlsx", CreateNew = true }))
            {
                v = (Object)Convert.ChangeType(ExcelWorkbookScope.ReadCell(sheetName: "Sheet1", cell: "E1", preserveFormat: false), typeof(Object));
            }
            Log(message: "E1: " + Convert.ToString(v), level: UiPath.CodedWorkflows.LogLevel.Info);
        }
    }
}
