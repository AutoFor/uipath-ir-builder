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
    // tools/ir/gen-coded.ts で IR（CreatePivotTableXv2_Min）から生成。手で直さず IR を直す
    public class CreatePivotTableXv2_Min : CodedWorkflow
    {
        [Workflow]
        public void Execute()
        {
            Object t = default;
            // 元のブックを output に写す
            system.CopyFile(path: "data\\excel\\Sample.xlsx", destination: "output\\CreatePivotTableXv2_Min.xlsx", overwrite: true);
            using (var Excel = excel.UseExcelFile(options: new UseOptions { Path = "output\\CreatePivotTableXv2_Min.xlsx", SaveChanges = true, CreateIfNotExist = true }))
            {
                var __collect1 = new PivotTableDescriptor { LayoutRowType = UiPath.Excel.PivotTableLayoutRowType.Compact, ValuesMode = UiPath.Excel.PivotTableValuesMode.Columns };
                __collect1.Rows.Add(new RowPivotTableFieldDescription { Name = "Name" });
                __collect1.Values.Add(new ValuePivotTableFieldDescription { Name = "Age", Function = UiPath.Excel.PivotTableFunction.Sum });
                Excel.Sheet["Sheet1"].Range["A1:C4"].CreatePivotTable(destinationTableName: "Pivot1", destination: Excel.Sheet["Sheet2"].Range["C3"], descriptor: __collect1);
                t = (Object)Convert.ChangeType(Excel.Sheet["Sheet2"].Cell["D7"].ReadCellValue(getFormattedText: true), typeof(Object));
                Log(message: "総計: [" + Convert.ToString(t) + "]", level: UiPath.CodedWorkflows.LogLevel.Info);
            }
        }
    }
}
