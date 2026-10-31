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
    // tools/ir/gen-coded.ts で IR（InsertSheetX_Min）から生成。手で直さず IR を直す
    public class InsertSheetX_Min : CodedWorkflow
    {
        [Workflow]
        public void Execute()
        {
            Object a1 = default;
            // 元のブックを output に写す
            system.CopyFile(path: "data\\excel\\Sample.xlsx", destination: "output\\InsertSheetX_Min.xlsx", overwrite: true);
            using (var Excel = excel.UseExcelFile(options: new UseOptions { Path = "output\\InsertSheetX_Min.xlsx", SaveChanges = true, CreateIfNotExist = true, ResizeWindow = UiPath.Excel.Model.ResizeWindowOptions.None }))
            {
                Excel.InsertSheet(sheetName: "Sheet3");
                Excel.Sheet["Sheet3"].Cell["A1"].WriteCell(value: "新しいシート");
                a1 = (Object)Convert.ChangeType(Excel.Sheet["Sheet3"].Cell["A1"].ReadCellValue(getFormattedText: true), typeof(Object));
                Log(message: "Sheet3 の A1: [" + Convert.ToString(a1) + "]", level: UiPath.CodedWorkflows.LogLevel.Info);
            }
        }
    }
}
