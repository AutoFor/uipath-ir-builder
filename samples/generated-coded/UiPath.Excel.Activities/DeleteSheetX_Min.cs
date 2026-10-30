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
    // tools/ir/gen-coded.ts で IR（DeleteSheetX_Min）から生成。手で直さず IR を直す
    public class DeleteSheetX_Min : CodedWorkflow
    {
        [Workflow]
        public void Execute()
        {
            Object a1 = default;
            // 元のブックを output に写す
            system.CopyFile(path: "data\\excel\\Sample.xlsx", destination: "output\\DeleteSheetX_Min.xlsx", overwrite: true);
            using (var Excel = excel.UseExcelFile(options: new UseOptions { Path = "output\\DeleteSheetX_Min.xlsx", SaveChanges = true, CreateIfNotExist = true }))
            {
                Excel.Sheet["Sheet2"].DeleteSheet();
                a1 = (Object)Convert.ChangeType(Excel.Sheet["Sheet1"].Cell["A1"].ReadCellValue(getFormattedText: true), typeof(Object));
                Log(message: "Sheet1 の A1: [" + Convert.ToString(a1) + "]", level: UiPath.CodedWorkflows.LogLevel.Info);
                // Sheet2 を読む
                try
                {
                    a1 = (Object)Convert.ChangeType(Excel.Sheet["Sheet2"].Cell["A1"].ReadCellValue(getFormattedText: true), typeof(Object));
                    Log(message: "Sheet2 が残っている", level: UiPath.CodedWorkflows.LogLevel.Info);
                }
                catch (Exception ex)
                {
                    Log(message: "Sheet2 は無い", level: UiPath.CodedWorkflows.LogLevel.Info);
                }
            }
        }
    }
}
