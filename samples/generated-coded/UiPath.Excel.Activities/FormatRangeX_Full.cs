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
    // tools/ir/gen-coded.ts で IR（FormatRangeX_Full）から生成。手で直さず IR を直す
    public class FormatRangeX_Full : CodedWorkflow
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
            using (var Excel = excel.UseExcelFile(options: new UseOptions { Path = "output\\FormatRangeX_Full.xlsx", SaveChanges = true, CreateIfNotExist = true }))
            {
                Excel.Sheet["Sheet1"].Range["A1"].WriteRange(source: dt, append: false, excludeHeaders: false);
                // 数値を小数 2 桁・太字・中央にする
                Excel.Sheet["Sheet1"].Range["B2:B4"].FormatRange(format: new UiPath.Excel.Activities.Business.NumberFormat { DecimalPlaces = 2, UseThousandSeparator = true }, alignment: new UiPath.Excel.AlignmentOptions { HorizontalAlignment = UiPath.Excel.ExcelRangeHorizontalAlignment.xlHAlignCenter, VerticalAlignment = UiPath.Excel.ExcelRangeVerticalAlignment.xlVAlignCenter, WrapText = true }, font: new UiPath.Excel.FontOptions { FontFamilyName = "Arial", Size = 14, Style = UiPath.Excel.ExcelRangeFontStyle.Bold, UnderlineStyle = UiPath.Excel.ExcelRangeUnderlineStyle.None });
                v1 = (Object)Convert.ChangeType(Excel.Sheet["Sheet1"].Cell["B2"].ReadCellValue(getFormattedText: true), typeof(Object));
            }
            Log(message: "B2=" + Convert.ToString(v1), level: UiPath.CodedWorkflows.LogLevel.Info);
        }
    }
}
