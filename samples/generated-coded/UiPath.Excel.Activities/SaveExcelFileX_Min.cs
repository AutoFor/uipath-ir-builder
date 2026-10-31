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
    // tools/ir/gen-coded.ts で IR（SaveExcelFileX_Min）から生成。手で直さず IR を直す
    public class SaveExcelFileX_Min : CodedWorkflow
    {
        [Workflow]
        public void Execute()
        {
            Object a1 = default;
            // 元のブックを output に写す
            system.CopyFile(path: "data\\excel\\Sample.xlsx", destination: "output\\SaveExcelFileX_Min.xlsx", overwrite: true);
            using (var Excel = excel.UseExcelFile(options: new UseOptions { Path = "output\\SaveExcelFileX_Min.xlsx", SaveChanges = false, CreateIfNotExist = true, ResizeWindow = UiPath.Excel.Model.ResizeWindowOptions.None }))
            {
                Excel.Sheet["Sheet1"].Cell["E1"].WriteCell(value: "保存した");
                Excel.SaveExcelFile();
            }
            using (var Excel = excel.UseExcelFile(options: new UseOptions { Path = "output\\SaveExcelFileX_Min.xlsx", SaveChanges = true, CreateIfNotExist = true, ReadOnly = true, ResizeWindow = UiPath.Excel.Model.ResizeWindowOptions.None }))
            {
                a1 = (Object)Convert.ChangeType(Excel.Sheet["Sheet1"].Cell["E1"].ReadCellValue(getFormattedText: true), typeof(Object));
                Log(message: "開き直した E1: [" + Convert.ToString(a1) + "]", level: UiPath.CodedWorkflows.LogLevel.Info);
            }
        }
    }
}
