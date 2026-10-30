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
    // tools/ir/gen-coded.ts で IR（DuplicateSheetX_Full）から生成。手で直さず IR を直す
    public class DuplicateSheetX_Full : CodedWorkflow
    {
        [Workflow]
        public void Execute()
        {
            Object a1 = default;
            Object b2 = default;
            // 元のブックを output に写す
            system.CopyFile(path: "data\\excel\\Sample.xlsx", destination: "output\\DuplicateSheetX_Full.xlsx", overwrite: true);
            using (var Excel = excel.UseExcelFile(options: new UseOptions { Path = "output\\DuplicateSheetX_Full.xlsx", SaveChanges = true, CreateIfNotExist = true }))
            {
                // Sheet1 を控えに写す
                Excel.Sheet["Sheet1"].DuplicateSheet(name: "Sheet1控え");
                a1 = (Object)Convert.ChangeType(Excel.Sheet["Sheet1控え"].Cell["A2"].ReadCellValue(getFormattedText: true), typeof(Object));
                Log(message: "控えの A2: [" + Convert.ToString(a1) + "]", level: UiPath.CodedWorkflows.LogLevel.Info);
                b2 = (Object)Convert.ChangeType(Excel.Sheet["Sheet1控え"].Cell["B2"].ReadCellValue(getFormattedText: true), typeof(Object));
                Log(message: "控えの B2: [" + Convert.ToString(b2) + "]", level: UiPath.CodedWorkflows.LogLevel.Info);
            }
        }
    }
}
