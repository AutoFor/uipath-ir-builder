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
    // tools/ir/gen-coded.ts で IR（AutoFitX_Full）から生成。手で直さず IR を直す
    public class AutoFitX_Full : CodedWorkflow
    {
        [Workflow]
        public void Execute()
        {
            DataTable dt = default;
            Object v1 = default;
            using (var Excel = excel.UseExcelFile(options: new UseOptions { Path = "data\\excel\\Sample.xlsx", SaveChanges = true, CreateIfNotExist = true, ReadOnly = true }))
            {
                dt = Excel.Sheet["Sheet1"].Range["A1:B4"].ReadRange(hasHeaders: true, visibleRowsOnly: true);
            }
            using (var Excel = excel.UseExcelFile(options: new UseOptions { Path = "output\\AutoFitX_Full.xlsx", SaveChanges = true, CreateIfNotExist = true }))
            {
                Excel.Sheet["Sheet1"].Range["A1"].WriteRange(source: dt, append: false, excludeHeaders: false);
                // 列だけ調整
                Excel.Sheet["Sheet1"].Range["A1:B4"].Autofit(columns: true, rows: false);
                v1 = (Object)Convert.ChangeType(Excel.Sheet["Sheet1"].Cell["A1"].ReadCellValue(getFormattedText: true), typeof(Object));
            }
            Log(message: "A1=" + Convert.ToString(v1), level: UiPath.CodedWorkflows.LogLevel.Info);
        }
    }
}
