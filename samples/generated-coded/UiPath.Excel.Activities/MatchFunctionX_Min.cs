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
    // tools/ir/gen-coded.ts で IR（MatchFunctionX_Min）から生成。手で直さず IR を直す
    public class MatchFunctionX_Min : CodedWorkflow
    {
        [Workflow]
        public void Execute()
        {
            Int32 pos = default;
            using (var Excel = excel.UseExcelFile(options: new UseOptions { Path = "data\\excel\\Sample.xlsx", SaveChanges = true, CreateIfNotExist = true, ReadOnly = true }))
            {
                pos = Excel.Sheet["Sheet1"].Range["B3:B4"].MatchFunction(valueToMatch: 30);
            }
            Log(message: "位置: " + pos.ToString(), level: UiPath.CodedWorkflows.LogLevel.Info);
        }
    }
}
