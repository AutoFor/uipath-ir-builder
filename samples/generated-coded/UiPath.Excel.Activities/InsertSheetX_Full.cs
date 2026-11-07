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
    // tools/ir/gen-coded.ts で IR（InsertSheetX_Full）から生成。手で直さず IR を直す
    public class InsertSheetX_Full : CodedWorkflow
    {
        [Workflow]
        public void Execute()
        {
            Object a1 = default;
            UiPath.Excel.ISheetRef newSheet = default;
            // 元のブックを output に写す
            system.CopyFile(path: "data\\excel\\Sample.xlsx", destination: "output\\InsertSheetX_Full.xlsx", overwrite: true);
            using (var Excel = excel.UseExcelFile(options: new UseOptions { Path = "output\\InsertSheetX_Full.xlsx", SaveChanges = true, CreateIfNotExist = true, ResizeWindow = UiPath.Excel.Model.ResizeWindowOptions.None }))
            {
                // シートを足す
                newSheet = Excel.InsertSheet(sheetName: "追加シート");
                Excel.Sheet["追加シート"].Cell["B2"].WriteCell(value: "参照を受けた");
                a1 = (Object)Convert.ChangeType(Excel.Sheet["追加シート"].Cell["B2"].ReadCellValue(getFormattedText: true), typeof(Object));
                Log(message: "追加シートの B2: [" + Convert.ToString(a1) + "]", level: UiPath.CodedWorkflows.LogLevel.Info);
            }
        }
    }
}
