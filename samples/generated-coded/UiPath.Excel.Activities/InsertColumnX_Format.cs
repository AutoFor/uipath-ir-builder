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
    // tools/ir/gen-coded.ts で IR（InsertColumnX_Format）から生成。手で直さず IR を直す
    public class InsertColumnX_Format : CodedWorkflow
    {
        [Workflow]
        public void Execute()
        {
            Object b1 = default;
            Object c1 = default;
            Object d1 = default;
            // 元のブックを output に写す
            system.CopyFile(path: "data\\excel\\Sample.xlsx", destination: "output\\InsertColumnX_Format.xlsx", overwrite: true);
            using (var Excel = excel.UseExcelFile(options: new UseOptions { Path = "output\\InsertColumnX_Format.xlsx", SaveChanges = true, CreateIfNotExist = true, ResizeWindow = UiPath.Excel.Model.ResizeWindowOptions.None }))
            {
                // Age の前に列を足す
                Excel.Sheet["Sheet1"].Range["A1:C4"].InsertColumn(columnName: "Age", position: UiPath.Excel.ColumnRelativePosition.Before, hasHeaders: true, newColumnHeader: "追加", columnFormat: new UiPath.Excel.Activities.Business.NumberFormat { DecimalPlaces = 2, UseThousandSeparator = true });
                b1 = (Object)Convert.ChangeType(Excel.Sheet["Sheet1"].Cell["B1"].ReadCellValue(getFormattedText: true), typeof(Object));
                Log(message: "B1: [" + Convert.ToString(b1) + "]", level: UiPath.CodedWorkflows.LogLevel.Info);
                c1 = (Object)Convert.ChangeType(Excel.Sheet["Sheet1"].Cell["C1"].ReadCellValue(getFormattedText: true), typeof(Object));
                Log(message: "C1: [" + Convert.ToString(c1) + "]", level: UiPath.CodedWorkflows.LogLevel.Info);
                d1 = (Object)Convert.ChangeType(Excel.Sheet["Sheet1"].Cell["D1"].ReadCellValue(getFormattedText: true), typeof(Object));
                Log(message: "D1: [" + Convert.ToString(d1) + "]", level: UiPath.CodedWorkflows.LogLevel.Info);
            }
        }
    }
}
