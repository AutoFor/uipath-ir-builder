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
    // tools/ir/gen-coded.ts で IR（WriteCellX_Min）から生成。手で直さず IR を直す
    public class WriteCellX_Min : CodedWorkflow
    {
        [Workflow]
        public void Execute()
        {
            String v = default;
            using (var Excel = excel.UseExcelFile(options: new UseOptions { Path = "output\\WriteCellX_Min.xlsx", SaveChanges = true, CreateIfNotExist = true }))
            {
                Excel.Sheet["Sheet1"].Cell["B2"].WriteCell(value: "こんにちは");
                v = (String)Convert.ChangeType(Excel.Sheet["Sheet1"].Cell["B2"].ReadCellValue(getFormattedText: true), typeof(String));
            }
            Log(message: "B2: " + v, level: UiPath.CodedWorkflows.LogLevel.Info);
        }
    }
}
