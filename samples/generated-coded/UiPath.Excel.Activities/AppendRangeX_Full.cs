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
    // tools/ir/gen-coded.ts で IR（AppendRangeX_Full）から生成。手で直さず IR を直す
    public class AppendRangeX_Full : CodedWorkflow
    {
        [Workflow]
        public void Execute()
        {
            DataTable dt = default;
            Object v1 = default;
            Object v2 = default;
            using (var Excel = excel.UseExcelFile(options: new UseOptions { Path = "data\\excel\\Sample.xlsx", SaveChanges = true, CreateIfNotExist = true, ReadOnly = true }))
            {
                dt = Excel.Sheet["Sheet1"].Range["A1:B4"].ReadRange(hasHeaders: true, visibleRowsOnly: true);
            }
            using (var Excel = excel.UseExcelFile(options: new UseOptions { Path = "output\\AppendRangeX_Full.xlsx", SaveChanges = true, CreateIfNotExist = true }))
            {
                Excel.Sheet["Sheet1"].Range["A1"].WriteRange(source: dt, append: false, excludeHeaders: false);
                // ヘッダーを除いて追記
                Excel.Sheet["Sheet1"].Range["A1:B4"].AppendRange(source: Excel.Sheet["Sheet1"].Range["A1:B2"], columnName: "Name", transpose: false, pasteOptions: UiPath.Excel.CopyPasteRangeOptions.Values, destinationHasHeaders: true, excludeSourceHeaders: true);
                v1 = (Object)Convert.ChangeType(Excel.Sheet["Sheet1"].Cell["A5"].ReadCellValue(getFormattedText: true), typeof(Object));
                v2 = (Object)Convert.ChangeType(Excel.Sheet["Sheet1"].Cell["B5"].ReadCellValue(getFormattedText: true), typeof(Object));
            }
            Log(message: "A5=" + Convert.ToString(v1) + " B5=" + Convert.ToString(v2), level: UiPath.CodedWorkflows.LogLevel.Info);
        }
    }
}
