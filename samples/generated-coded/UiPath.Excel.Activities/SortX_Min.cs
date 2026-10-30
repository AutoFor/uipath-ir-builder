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
    // tools/ir/gen-coded.ts で IR（SortX_Min）から生成。手で直さず IR を直す
    public class SortX_Min : CodedWorkflow
    {
        [Workflow]
        public void Execute()
        {
            Object a2 = default;
            // 元のブックを output に写す
            system.CopyFile(path: "data\\excel\\Sample.xlsx", destination: "output\\SortX_Min.xlsx", overwrite: true);
            using (var Excel = excel.UseExcelFile(options: new UseOptions { Path = "output\\SortX_Min.xlsx", SaveChanges = true, CreateIfNotExist = true }))
            {
                var __collect1 = new SortXDescriptor();
                __collect1.SortColumns.Add(new SortXColumnModel("Age", UiPath.Excel.OrderType.Ascending));
                Excel.Sheet["Sheet1"].Range["A1:C4"].Sort(descriptor: __collect1, hasHeaders: true);
                a2 = (Object)Convert.ChangeType(Excel.Sheet["Sheet1"].Cell["A2"].ReadCellValue(getFormattedText: true), typeof(Object));
                Log(message: "A2: [" + Convert.ToString(a2) + "]", level: UiPath.CodedWorkflows.LogLevel.Info);
            }
        }
    }
}
