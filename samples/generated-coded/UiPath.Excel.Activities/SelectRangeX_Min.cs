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
    // tools/ir/gen-coded.ts で IR（SelectRangeX_Min）から生成。手で直さず IR を直す
    public class SelectRangeX_Min : CodedWorkflow
    {
        [Workflow]
        public void Execute()
        {
            UiPath.Excel.IReadRangeRef rng = default;
            using (var Excel = excel.UseExcelFile(options: new UseOptions { Path = "data\\excel\\Sample.xlsx", SaveChanges = true, CreateIfNotExist = true, ReadOnly = true, ResizeWindow = UiPath.Excel.Model.ResizeWindowOptions.None }))
            {
                Excel.Sheet["Sheet1"].Range["B2:C3"].SelectRange();
                rng = Excel.SelectedRange;
            }
            Log(message: "selected: " + rng.Address, level: UiPath.CodedWorkflows.LogLevel.Info);
        }
    }
}
