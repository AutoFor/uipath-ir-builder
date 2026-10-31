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
    // tools/ir/gen-coded.ts で IR（FindReplaceValueX_Min）から生成。手で直さず IR を直す
    public class FindReplaceValueX_Min : CodedWorkflow
    {
        [Workflow]
        public void Execute()
        {
            String at = default;
            using (var Excel = excel.UseExcelFile(options: new UseOptions { Path = "data\\excel\\Sample.xlsx", SaveChanges = true, CreateIfNotExist = true, ReadOnly = true, ResizeWindow = UiPath.Excel.Model.ResizeWindowOptions.None }))
            {
                at = Excel.Sheet["Sheet1"].Range["A1:B4"].FindReplaceValue(valueToFind: "花子", operation: UiPath.Excel.FindReplaceOptions.Find, replaceWith: null, lookIn: UiPath.Excel.LookInOptions.Values, matchCase: false, matchEntireCellContents: false);
            }
            Log(message: "見つかった場所: " + at, level: UiPath.CodedWorkflows.LogLevel.Info);
        }
    }
}
