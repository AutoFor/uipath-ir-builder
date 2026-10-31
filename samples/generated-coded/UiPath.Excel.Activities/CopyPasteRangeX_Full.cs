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
    // tools/ir/gen-coded.ts で IR（CopyPasteRangeX_Full）から生成。手で直さず IR を直す
    public class CopyPasteRangeX_Full : CodedWorkflow
    {
        [Workflow]
        public void Execute()
        {
            DataTable dt = default;
            Object v1 = default;
            Object v2 = default;
            using (var Excel = excel.UseExcelFile(options: new UseOptions { Path = "data\\excel\\Sample.xlsx", SaveChanges = true, CreateIfNotExist = true, ReadOnly = true, ResizeWindow = UiPath.Excel.Model.ResizeWindowOptions.None }))
            {
                dt = Excel.Sheet["Sheet1"].Range["A1:B4"].ReadRange(hasHeaders: true, visibleRowsOnly: true);
            }
            using (var Excel = excel.UseExcelFile(options: new UseOptions { Path = "output\\CopyPasteRangeX_Full.xlsx", SaveChanges = true, CreateIfNotExist = true, ResizeWindow = UiPath.Excel.Model.ResizeWindowOptions.None }))
            {
                Excel.Sheet["Sheet1"].Range["A1"].WriteRange(source: dt, append: false, excludeHeaders: false, ignoreEmptySource: false);
                // 転置して値だけ貼る
                Excel.Sheet["Sheet1"].Range["D1"].CopyPasteRange(sourceRange: Excel.Sheet["Sheet1"].Range["A2:B4"], excludeSourceHeaders: false, excludeDestinationHeaders: false, transpose: true, options: UiPath.Excel.CopyPasteRangeOptions.Values);
                v1 = (Object)Convert.ChangeType(Excel.Sheet["Sheet1"].Cell["E1"].ReadCellValue(getFormattedText: true), typeof(Object));
                v2 = (Object)Convert.ChangeType(Excel.Sheet["Sheet1"].Cell["E2"].ReadCellValue(getFormattedText: true), typeof(Object));
            }
            Log(message: "E1=" + Convert.ToString(v1) + " E2=" + Convert.ToString(v2), level: UiPath.CodedWorkflows.LogLevel.Info);
        }
    }
}
