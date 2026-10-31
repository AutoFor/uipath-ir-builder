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
    // tools/ir/gen-coded.ts で IR（ExcelForEachRowX_Min）から生成。手で直さず IR を直す
    public class ExcelForEachRowX_Min : CodedWorkflow
    {
        [Workflow]
        public void Execute()
        {
            using (var Excel = excel.UseExcelFile(options: new UseOptions { Path = "data\\excel\\Sample.xlsx", SaveChanges = true, CreateIfNotExist = true, ReadOnly = true, ResizeWindow = UiPath.Excel.Model.ResizeWindowOptions.None }))
            {
                var __index1 = 0;
                Excel.Sheet["Sheet1"].Range["A1:C4"].ForEachRow(emptyRowBehavior: UiPath.Excel.EmptyRowBehavior.Stop, forceFirstRowAsHeaders: true, saveAfterEachRow: false, act: CurrentRow =>
                {
                    __index1++;
                    int CurrentIndex = __index1;
                    Log(message: CurrentIndex.ToString() + ": " + CurrentRow["Name"].ToString(), level: UiPath.CodedWorkflows.LogLevel.Info);
                });
            }
        }
    }
}
