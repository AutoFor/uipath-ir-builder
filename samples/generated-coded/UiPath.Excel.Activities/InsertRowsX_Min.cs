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
    // tools/ir/gen-coded.ts で IR（InsertRowsX_Min）から生成。手で直さず IR を直す
    public class InsertRowsX_Min : CodedWorkflow
    {
        [Workflow]
        public void Execute()
        {
            Object a2 = default;
            Object a3 = default;
            Object a4 = default;
            Object a5 = default;
            Object a6 = default;
            Object a7 = default;
            // 元のブックを output に写す
            system.CopyFile(path: "data\\excel\\Sample.xlsx", destination: "output\\InsertRowsX_Min.xlsx", overwrite: true);
            using (var Excel = excel.UseExcelFile(options: new UseOptions { Path = "output\\InsertRowsX_Min.xlsx", SaveChanges = true, CreateIfNotExist = true, ResizeWindow = UiPath.Excel.Model.ResizeWindowOptions.None }))
            {
                Excel.Sheet["Sheet1"].Cell["A6"].WriteCell(value: "下の行");
                Excel.Sheet["Sheet1"].Range["A1:C4"].InsertRows(nbOfRows: 1, insertPosition: UiPath.Excel.InsertRowPosition.End, specificIndex: 0, hasHeaders: true);
                a5 = (Object)Convert.ChangeType(Excel.Sheet["Sheet1"].Cell["A5"].ReadCellValue(getFormattedText: true), typeof(Object));
                Log(message: "A5: [" + Convert.ToString(a5) + "]", level: UiPath.CodedWorkflows.LogLevel.Info);
                a6 = (Object)Convert.ChangeType(Excel.Sheet["Sheet1"].Cell["A6"].ReadCellValue(getFormattedText: true), typeof(Object));
                Log(message: "A6: [" + Convert.ToString(a6) + "]", level: UiPath.CodedWorkflows.LogLevel.Info);
                a7 = (Object)Convert.ChangeType(Excel.Sheet["Sheet1"].Cell["A7"].ReadCellValue(getFormattedText: true), typeof(Object));
                Log(message: "A7: [" + Convert.ToString(a7) + "]", level: UiPath.CodedWorkflows.LogLevel.Info);
            }
        }
    }
}
