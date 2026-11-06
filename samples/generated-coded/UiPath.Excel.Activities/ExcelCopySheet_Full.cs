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
    // tools/ir/gen-coded.ts で IR（ExcelCopySheet_Full）から生成。手で直さず IR を直す
    public class ExcelCopySheet_Full : CodedWorkflow
    {
        [Workflow]
        public void Execute()
        {
            Object v = default;
            Object w = default;
            // 元のブックを output に写す
            system.CopyFile(path: "data\\excel\\Sample.xlsx", destination: "output\\ExcelCopySheet_Full.xlsx", overwrite: true);
            // ExcelApplicationScope は中に Coded API の無いアクティビティがあり、それだけをスコープの外に出せないので XAML 経由（coded/_xaml/ExcelCopySheet_Full_1.xaml）
            RunWorkflow("coded/_xaml/ExcelCopySheet_Full_1.xaml", null);
            using (var ExcelWorkbookScope = excel.UseWorkBook(options: new WorkbookOptions { Path = "output\\ExcelCopySheet_Full_copy.xlsx", CreateNew = true }))
            {
                v = (Object)Convert.ChangeType(ExcelWorkbookScope.ReadCell(sheetName: "控え", cell: "A2", preserveFormat: false), typeof(Object));
            }
            Log(message: "コピー先 A2: " + Convert.ToString(v), level: UiPath.CodedWorkflows.LogLevel.Info);
        }
    }
}
