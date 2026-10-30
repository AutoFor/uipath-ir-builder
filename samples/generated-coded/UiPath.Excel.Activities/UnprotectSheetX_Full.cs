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
    // tools/ir/gen-coded.ts で IR（UnprotectSheetX_Full）から生成。手で直さず IR を直す
    public class UnprotectSheetX_Full : CodedWorkflow
    {
        [Workflow]
        public void Execute()
        {
            Object a1 = default;
            // 元のブックを output に写す
            system.CopyFile(path: "data\\excel\\Sample.xlsx", destination: "output\\UnprotectSheetX_Full.xlsx", overwrite: true);
            using (var Excel = excel.UseExcelFile(options: new UseOptions { Path = "output\\UnprotectSheetX_Full.xlsx", SaveChanges = true, CreateIfNotExist = true }))
            {
                Excel.Sheet["Sheet1"].ProtectSheet(password: "pw123", additionalPermissions: UiPath.Excel.ProtectSheetAdditionalPermissions.None);
                // パスワードで解除
                Excel.Sheet["Sheet1"].UnprotectSheet(password: "pw123");
                Excel.Sheet["Sheet1"].Cell["E1"].WriteCell(value: "解除後に書いた");
                a1 = (Object)Convert.ChangeType(Excel.Sheet["Sheet1"].Cell["E1"].ReadCellValue(getFormattedText: true), typeof(Object));
                Log(message: "E1: [" + Convert.ToString(a1) + "]", level: UiPath.CodedWorkflows.LogLevel.Info);
            }
        }
    }
}
