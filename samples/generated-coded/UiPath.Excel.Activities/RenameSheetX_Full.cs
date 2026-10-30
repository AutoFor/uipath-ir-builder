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
    // tools/ir/gen-coded.ts で IR（RenameSheetX_Full）から生成。手で直さず IR を直す
    public class RenameSheetX_Full : CodedWorkflow
    {
        [Workflow]
        public void Execute()
        {
            Object a1 = default;
            // 元のブックを output に写す
            system.CopyFile(path: "data\\excel\\Sample.xlsx", destination: "output\\RenameSheetX_Full.xlsx", overwrite: true);
            using (var Excel = excel.UseExcelFile(options: new UseOptions { Path = "output\\RenameSheetX_Full.xlsx", SaveChanges = true, CreateIfNotExist = true }))
            {
                // Sheet1 を改名
                Excel.Sheet["Sheet1"].RenameSheet(name: "名簿");
                a1 = (Object)Convert.ChangeType(Excel.Sheet["名簿"].Cell["A2"].ReadCellValue(getFormattedText: true), typeof(Object));
                Log(message: "名簿の A2: [" + Convert.ToString(a1) + "]", level: UiPath.CodedWorkflows.LogLevel.Info);
            }
        }
    }
}
