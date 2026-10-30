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
    // tools/ir/gen-coded.ts で IR（RemoveDuplicatesX_Min）から生成。手で直さず IR を直す
    public class RemoveDuplicatesX_Min : CodedWorkflow
    {
        [Workflow]
        public void Execute()
        {
            Object a1 = default;
            Object a2 = default;
            Object a3 = default;
            Object a4 = default;
            Object a5 = default;
            Object b5 = default;
            // 元のブックを output に写す
            system.CopyFile(path: "data\\excel\\Sample.xlsx", destination: "output\\RemoveDuplicatesX_Min.xlsx", overwrite: true);
            using (var Excel = excel.UseExcelFile(options: new UseOptions { Path = "output\\RemoveDuplicatesX_Min.xlsx", SaveChanges = true, CreateIfNotExist = true }))
            {
                Excel.Sheet["Sheet1"].Cell["A5"].WriteCell(value: "太郎");
                Excel.Sheet["Sheet1"].Cell["B5"].WriteCell(value: 30);
                Excel.Sheet["Sheet1"].Cell["C5"].WriteCell(value: 60);
                Excel.Sheet["Sheet1"].Range["A1:C5"].RemoveDuplicates(hasHeaders: true, columnsMode: UiPath.Excel.ColumnsCompare.AllColumns, columns: new string[] { "Name", "Age", "Double" });
                a4 = (Object)Convert.ChangeType(Excel.Sheet["Sheet1"].Cell["A4"].ReadCellValue(getFormattedText: true), typeof(Object));
                Log(message: "A4: [" + Convert.ToString(a4) + "]", level: UiPath.CodedWorkflows.LogLevel.Info);
                a5 = (Object)Convert.ChangeType(Excel.Sheet["Sheet1"].Cell["A5"].ReadCellValue(getFormattedText: true), typeof(Object));
                Log(message: "A5: [" + Convert.ToString(a5) + "]", level: UiPath.CodedWorkflows.LogLevel.Info);
            }
        }
    }
}
