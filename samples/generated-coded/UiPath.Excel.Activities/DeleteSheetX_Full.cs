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
    // tools/ir/gen-coded.ts で IR（DeleteSheetX_Full）から生成。手で直さず IR を直す
    public class DeleteSheetX_Full : CodedWorkflow
    {
        [Workflow]
        public void Execute()
        {
            Object a1 = default;
            // 元のブックを output に写す
            system.CopyFile(path: "data\\excel\\Sample.xlsx", destination: "output\\DeleteSheetX_Full.xlsx", overwrite: true);
            using (var Excel = excel.UseExcelFile(options: new UseOptions { Path = "output\\DeleteSheetX_Full.xlsx", SaveChanges = true, CreateIfNotExist = true }))
            {
                // Sheet2 を消す
                Excel.Sheet["Sheet2"].DeleteSheet();
                a1 = (Object)Convert.ChangeType(Excel.Sheet["Sheet1"].Cell["A1"].ReadCellValue(getFormattedText: true), typeof(Object));
                Log(message: "Sheet1 の A1: [" + Convert.ToString(a1) + "]", level: UiPath.CodedWorkflows.LogLevel.Info);
                // 元の名前のシートを読む（無いと空のシートが作られる）
                a1 = (Object)Convert.ChangeType(Excel.Sheet["Sheet2"].Cell["A1"].ReadCellValue(getFormattedText: true), typeof(Object));
                Log(message: "Sheet2 の A1: [" + Convert.ToString(a1) + "]", level: UiPath.CodedWorkflows.LogLevel.Info);
            }
        }
    }
}
