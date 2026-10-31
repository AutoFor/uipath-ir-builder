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
    // tools/ir/gen-coded.ts で IR（LookupX_Full）から生成。手で直さず IR を直す
    public class LookupX_Full : CodedWorkflow
    {
        [Workflow]
        public void Execute()
        {
            Object v = default;
            using (var Excel = excel.UseExcelFile(options: new UseOptions { Path = "output\\LookupX_Full.xlsx", SaveChanges = true, CreateIfNotExist = true, ResizeWindow = UiPath.Excel.Model.ResizeWindowOptions.None }))
            {
                Excel.Sheet["Sheet1"].Cell["A1"].WriteCell(value: "apple");
                Excel.Sheet["Sheet1"].Cell["B1"].WriteCell(value: "りんご");
                Excel.Sheet["Sheet1"].Cell["A2"].WriteCell(value: "banana");
                Excel.Sheet["Sheet1"].Cell["B2"].WriteCell(value: "バナナ");
                Excel.Sheet["Sheet1"].Cell["A3"].WriteCell(value: "cherry");
                Excel.Sheet["Sheet1"].Cell["B3"].WriteCell(value: "さくらんぼ");
                // cherry の和名
                v = (Object)Convert.ChangeType(Excel.Sheet["Sheet1"].Range["A1:A3"].LookupRange(label: "cherry", resultRange: Excel.Sheet["Sheet1"].Range["B1:B3"]), typeof(Object));
            }
            Log(message: "値: " + Convert.ToString(v), level: UiPath.CodedWorkflows.LogLevel.Info);
        }
    }
}
