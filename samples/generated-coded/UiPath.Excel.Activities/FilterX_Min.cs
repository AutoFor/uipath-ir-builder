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
    // tools/ir/gen-coded.ts で IR（FilterX_Min）から生成。手で直さず IR を直す
    public class FilterX_Min : CodedWorkflow
    {
        [Workflow]
        public void Execute()
        {
            DataTable dt = default;
            // 元のブックを output に写す
            system.CopyFile(path: "data\\excel\\Sample.xlsx", destination: "output\\FilterX_Min.xlsx", overwrite: true);
            using (var Excel = excel.UseExcelFile(options: new UseOptions { Path = "output\\FilterX_Min.xlsx", SaveChanges = true, CreateIfNotExist = true }))
            {
                Excel.Sheet["Sheet1"].Range["A1:C4"].Filter(options: new FilterOptions { ColumnName = "Name", Filter = new BasicFilter { Values = new List<string> { "花子" } } });
                dt = Excel.Sheet["Sheet1"].Range["A1:C4"].ReadRange(hasHeaders: true, visibleRowsOnly: true);
                Log(message: "行数: " + dt.Rows.Count.ToString(), level: UiPath.CodedWorkflows.LogLevel.Info);
                Log(message: "先頭: " + dt.Rows[0][0].ToString(), level: UiPath.CodedWorkflows.LogLevel.Info);
            }
        }
    }
}
