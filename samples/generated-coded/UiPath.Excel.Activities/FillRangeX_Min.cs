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
    // tools/ir/gen-coded.ts で IR（FillRangeX_Min）から生成。手で直さず IR を直す
    public class FillRangeX_Min : CodedWorkflow
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
            using (var Excel = excel.UseExcelFile(options: new UseOptions { Path = "output\\FillRangeX_Min.xlsx", SaveChanges = true, CreateIfNotExist = true, ResizeWindow = UiPath.Excel.Model.ResizeWindowOptions.None }))
            {
                Excel.Sheet["Sheet1"].Range["A1"].WriteRange(source: dt, append: false, excludeHeaders: false, ignoreEmptySource: false);
                Excel.Sheet["Sheet1"].Range["C2:C4"].FillRange(value: "済");
                v1 = (Object)Convert.ChangeType(Excel.Sheet["Sheet1"].Cell["C2"].ReadCellValue(getFormattedText: true), typeof(Object));
                v2 = (Object)Convert.ChangeType(Excel.Sheet["Sheet1"].Cell["C4"].ReadCellValue(getFormattedText: true), typeof(Object));
            }
            Log(message: "C2=" + Convert.ToString(v1) + " C4=" + Convert.ToString(v2), level: UiPath.CodedWorkflows.LogLevel.Info);
        }
    }
}
