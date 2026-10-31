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
    // tools/ir/gen-coded.ts で IR（ReadCellValueX_Full）から生成。手で直さず IR を直す
    public class ReadCellValueX_Full : CodedWorkflow
    {
        [Workflow]
        public void Execute()
        {
            Object v = default;
            using (var Excel = excel.UseExcelFile(options: new UseOptions { Path = "data\\excel\\Sample.xlsx", SaveChanges = true, CreateIfNotExist = true, ReadOnly = true, ResizeWindow = UiPath.Excel.Model.ResizeWindowOptions.None }))
            {
                // 式の結果を読む
                v = (Object)Convert.ChangeType(Excel.Sheet["Sheet1"].Cell["C2"].ReadCellValue(getFormattedText: false), typeof(Object));
            }
            Log(message: "C2: " + v.ToString(), level: UiPath.CodedWorkflows.LogLevel.Info);
        }
    }
}
