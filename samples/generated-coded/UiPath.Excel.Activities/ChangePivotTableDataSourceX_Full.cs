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
    // tools/ir/gen-coded.ts で IR（ChangePivotTableDataSourceX_Full）から生成。手で直さず IR を直す
    public class ChangePivotTableDataSourceX_Full : CodedWorkflow
    {
        [Workflow]
        public void Execute()
        {
            Object t = default;
            // 元のブックを output に写す
            system.CopyFile(path: "data\\excel\\Sample.xlsx", destination: "output\\ChangePivotTableDataSourceX_Full.xlsx", overwrite: true);
            using (var Excel = excel.UseExcelFile(options: new UseOptions { Path = "output\\ChangePivotTableDataSourceX_Full.xlsx", SaveChanges = true, CreateIfNotExist = true }))
            {
                var __collect1 = new PivotTableDescriptor { LayoutRowType = UiPath.Excel.PivotTableLayoutRowType.Compact, ValuesMode = UiPath.Excel.PivotTableValuesMode.Columns };
                __collect1.Rows.Add(new RowPivotTableFieldDescription { Name = "Name" });
                __collect1.Values.Add(new ValuePivotTableFieldDescription { Name = "Age", Function = UiPath.Excel.PivotTableFunction.Sum });
                Excel.Sheet["Sheet1"].Range["A1:C4"].CreatePivotTable(destinationTableName: "Pivot1", destination: Excel.Sheet["Sheet2"].Range["C3"], descriptor: __collect1);
                // 元の範囲を1行にする
                Excel.Sheet["Sheet1"].Range["A1:C2"].ChangePivotTableDataSource(pivotTable: Excel.Sheet["Sheet2"].PivotTable["Pivot1"]);
                Excel.Sheet["Sheet2"].PivotTable["Pivot1"].RefreshPivotTable(layoutRowType: UiPath.Excel.PivotTableLayoutRowType.Compact);
                t = (Object)Convert.ChangeType(Excel.Sheet["Sheet2"].Cell["D5"].ReadCellValue(getFormattedText: true), typeof(Object));
                Log(message: "総計: [" + Convert.ToString(t) + "]", level: UiPath.CodedWorkflows.LogLevel.Info);
            }
        }
    }
}
