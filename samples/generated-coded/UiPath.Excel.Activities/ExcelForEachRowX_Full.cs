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
    // tools/ir/gen-coded.ts で IR（ExcelForEachRowX_Full）から生成。手で直さず IR を直す
    public class ExcelForEachRowX_Full : CodedWorkflow
    {
        [Workflow]
        public void Execute()
        {
            Object d2 = default;
            // 元のブックを output に写す
            system.CopyFile(path: "data\\excel\\Sample.xlsx", destination: "output\\ExcelForEachRowX_Full.xlsx", overwrite: true);
            using (var Excel = excel.UseExcelFile(options: new UseOptions { Path = "output\\ExcelForEachRowX_Full.xlsx", SaveChanges = true, CreateIfNotExist = true, ResizeWindow = UiPath.Excel.Model.ResizeWindowOptions.None }))
            {
                // 行ごと
                var __index1 = 0;
                Excel.Sheet["Sheet1"].Range["A1:C4"].ForEachRow(emptyRowBehavior: UiPath.Excel.EmptyRowBehavior.Stop, forceFirstRowAsHeaders: true, saveAfterEachRow: true, func: CurrentRow =>
                {
                    __index1++;
                    int CurrentIndex = __index1;
                    if (CurrentIndex == 1)
                    {
                        return true;
                    }
                    if (CurrentIndex == 3)
                    {
                        return false;
                    }
                    Log(message: "処理: " + CurrentRow["Name"].ToString(), level: UiPath.CodedWorkflows.LogLevel.Info);
                    return true;
                });
            }
        }
    }
}
