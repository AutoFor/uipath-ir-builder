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
    // tools/ir/gen-coded.ts で IR（InsertRowsX_Full）から生成。手で直さず IR を直す
    public class InsertRowsX_Full : CodedWorkflow
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
            system.CopyFile(path: "data\\excel\\Sample.xlsx", destination: "output\\InsertRowsX_Full.xlsx", overwrite: true);
            using (var Excel = excel.UseExcelFile(options: new UseOptions { Path = "output\\InsertRowsX_Full.xlsx", SaveChanges = true, CreateIfNotExist = true, ResizeWindow = UiPath.Excel.Model.ResizeWindowOptions.None }))
            {
                // 2 行目に 2 行足す
                Excel.Sheet["Sheet1"].Range["A1:C4"].InsertRows(nbOfRows: 2, insertPosition: UiPath.Excel.InsertRowPosition.Specific, specificIndex: 2, hasHeaders: true);
                a2 = (Object)Convert.ChangeType(Excel.Sheet["Sheet1"].Cell["A2"].ReadCellValue(getFormattedText: true), typeof(Object));
                Log(message: "A2: [" + Convert.ToString(a2) + "]", level: UiPath.CodedWorkflows.LogLevel.Info);
                a3 = (Object)Convert.ChangeType(Excel.Sheet["Sheet1"].Cell["A3"].ReadCellValue(getFormattedText: true), typeof(Object));
                Log(message: "A3: [" + Convert.ToString(a3) + "]", level: UiPath.CodedWorkflows.LogLevel.Info);
                a4 = (Object)Convert.ChangeType(Excel.Sheet["Sheet1"].Cell["A4"].ReadCellValue(getFormattedText: true), typeof(Object));
                Log(message: "A4: [" + Convert.ToString(a4) + "]", level: UiPath.CodedWorkflows.LogLevel.Info);
                a5 = (Object)Convert.ChangeType(Excel.Sheet["Sheet1"].Cell["A5"].ReadCellValue(getFormattedText: true), typeof(Object));
                Log(message: "A5: [" + Convert.ToString(a5) + "]", level: UiPath.CodedWorkflows.LogLevel.Info);
                a6 = (Object)Convert.ChangeType(Excel.Sheet["Sheet1"].Cell["A6"].ReadCellValue(getFormattedText: true), typeof(Object));
                Log(message: "A6: [" + Convert.ToString(a6) + "]", level: UiPath.CodedWorkflows.LogLevel.Info);
            }
        }
    }
}
