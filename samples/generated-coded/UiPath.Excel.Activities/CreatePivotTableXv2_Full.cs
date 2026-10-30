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
    // tools/ir/gen-coded.ts で IR（CreatePivotTableXv2_Full）から生成。手で直さず IR を直す
    public class CreatePivotTableXv2_Full : CodedWorkflow
    {
        [Workflow]
        public void Execute()
        {
            Object t = default;
            // 元のブックを output に写す
            system.CopyFile(path: "data\\excel\\Sample.xlsx", destination: "output\\CreatePivotTableXv2_Full.xlsx", overwrite: true);
            using (var Excel = excel.UseExcelFile(options: new UseOptions { Path = "output\\CreatePivotTableXv2_Full.xlsx", SaveChanges = true, CreateIfNotExist = true }))
            {
                var __collect1 = new PivotTableDescriptor { LayoutRowType = UiPath.Excel.PivotTableLayoutRowType.Tabular, ValuesMode = UiPath.Excel.PivotTableValuesMode.Columns };
                // 行
                __collect1.Rows.Add(new RowPivotTableFieldDescription { Name = "Name" });
                // 値1
                __collect1.Values.Add(new ValuePivotTableFieldDescription { Name = "Age", Function = UiPath.Excel.PivotTableFunction.Max });
                // 値2
                __collect1.Values.Add(new ValuePivotTableFieldDescription { Name = "Double", Function = UiPath.Excel.PivotTableFunction.Sum });
                Excel.Sheet["Sheet1"].Range["A1:C4"].CreatePivotTable(destinationTableName: "Pivot1", destination: Excel.Sheet["Sheet2"].Range["C3"], descriptor: __collect1);
                t = (Object)Convert.ChangeType(Excel.Sheet["Sheet2"].Cell["D7"].ReadCellValue(getFormattedText: true), typeof(Object));
                Log(message: "年齢の最大: [" + Convert.ToString(t) + "]", level: UiPath.CodedWorkflows.LogLevel.Info);
            }
        }
    }
}
