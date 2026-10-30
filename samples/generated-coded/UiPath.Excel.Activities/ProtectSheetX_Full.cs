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
    // tools/ir/gen-coded.ts で IR（ProtectSheetX_Full）から生成。手で直さず IR を直す
    public class ProtectSheetX_Full : CodedWorkflow
    {
        [Workflow]
        public void Execute()
        {
            Object a1 = default;
            // 元のブックを output に写す
            system.CopyFile(path: "data\\excel\\Sample.xlsx", destination: "output\\ProtectSheetX_Full.xlsx", overwrite: true);
            using (var Excel = excel.UseExcelFile(options: new UseOptions { Path = "output\\ProtectSheetX_Full.xlsx", SaveChanges = true, CreateIfNotExist = true }))
            {
                // パスワード付きで保護
                Excel.Sheet["Sheet1"].ProtectSheet(password: "pw123", additionalPermissions: UiPath.Excel.ProtectSheetAdditionalPermissions.AllowSorting);
                // 保護中のシートに書く
                try
                {
                    Excel.Sheet["Sheet1"].Cell["E1"].WriteCell(value: "書けた");
                    Log(message: "保護されていない", level: UiPath.CodedWorkflows.LogLevel.Info);
                }
                catch (Exception ex)
                {
                    Log(message: "保護されていて書けなかった", level: UiPath.CodedWorkflows.LogLevel.Info);
                }
            }
        }
    }
}
