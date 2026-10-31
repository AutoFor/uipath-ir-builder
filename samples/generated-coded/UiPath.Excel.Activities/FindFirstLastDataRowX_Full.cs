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
    // tools/ir/gen-coded.ts で IR（FindFirstLastDataRowX_Full）から生成。手で直さず IR を直す
    public class FindFirstLastDataRowX_Full : CodedWorkflow
    {
        [Workflow]
        public void Execute()
        {
            Int32 first = default;
            Int32 last = default;
            using (var Excel = excel.UseExcelFile(options: new UseOptions { Path = "data\\excel\\Sample.xlsx", SaveChanges = true, CreateIfNotExist = true, ReadOnly = true, ResizeWindow = UiPath.Excel.Model.ResizeWindowOptions.None }))
            {
                // データ行の範囲
                (first, last) = Excel.Sheet["Sheet1"].Range["A1:B4"].FindFirstLastDataRow(columnName: "Name", hasHeaders: true, visibleRowsOnly: false, firstRowOffset: 0, lastRowOffset: 0, blankRowsToSkip: 1, configureLastRowAs: UiPath.Excel.LastRowConfiguration.LastPopulatedRow);
            }
            Log(message: "first=" + first.ToString() + " last=" + last.ToString(), level: UiPath.CodedWorkflows.LogLevel.Info);
        }
    }
}
