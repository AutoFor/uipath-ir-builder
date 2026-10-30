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
    // tools/ir/gen-coded.ts で IR（SaveExcelFileAsX_Full）から生成。手で直さず IR を直す
    public class SaveExcelFileAsX_Full : CodedWorkflow
    {
        [Workflow]
        public void Execute()
        {
            Object a1 = default;
            Boolean ex = default;
            // 元のブックを output に写す
            system.CopyFile(path: "data\\excel\\Sample.xlsx", destination: "output\\SaveExcelFileAsX_Full.xlsx", overwrite: true);
            using (var Excel = excel.UseExcelFile(options: new UseOptions { Path = "output\\SaveExcelFileAsX_Full.xlsx", SaveChanges = true, CreateIfNotExist = true }))
            {
                Excel.Sheet["Sheet1"].Cell["E1"].WriteCell(value: "xlsb で保存");
                // xlsb で保存
                Excel.SaveExcelFileAs(filePath: "output\\SaveExcelFileAsX_Full.copy.xlsb", replaceExisting: true, saveAsType: UiPath.Excel.ExcelSaveAsType.BinaryWorkbook);
            }
            ex = system.PathExists(path: "output\\SaveExcelFileAsX_Full.copy.xlsb", pathType: UiPath.Core.Activities.PathType.File);
            Log(message: "xlsb がある: " + ex.ToString(), level: UiPath.CodedWorkflows.LogLevel.Info);
            using (var Excel = excel.UseExcelFile(options: new UseOptions { Path = "output\\SaveExcelFileAsX_Full.copy.xlsb", SaveChanges = true, CreateIfNotExist = true, ReadOnly = true }))
            {
                a1 = (Object)Convert.ChangeType(Excel.Sheet["Sheet1"].Cell["E1"].ReadCellValue(getFormattedText: true), typeof(Object));
                Log(message: "xlsb の E1: [" + Convert.ToString(a1) + "]", level: UiPath.CodedWorkflows.LogLevel.Info);
            }
        }
    }
}
