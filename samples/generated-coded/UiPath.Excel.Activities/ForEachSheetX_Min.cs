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
    // tools/ir/gen-coded.ts で IR（ForEachSheetX_Min）から生成。手で直さず IR を直す
    public class ForEachSheetX_Min : CodedWorkflow
    {
        [Workflow]
        public void Execute()
        {
            using (var Excel = excel.UseExcelFile(options: new UseOptions { Path = "data\\excel\\Sample.xlsx", SaveChanges = true, CreateIfNotExist = true, ReadOnly = true }))
            {
                var __index1 = 0;
                Excel.ForEachSheet(act: CurrentSheet =>
                {
                    __index1++;
                    int CurrentIndex = __index1;
                    Log(message: CurrentIndex.ToString() + ": " + CurrentSheet.Name, level: UiPath.CodedWorkflows.LogLevel.Info);
                });
            }
        }
    }
}
