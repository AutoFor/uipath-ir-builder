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
    // tools/ir/gen-coded.ts で IR（WriteRangeX_Min）から生成。手で直さず IR を直す
    public class WriteRangeX_Min : CodedWorkflow
    {
        [Workflow]
        public void Execute()
        {
            DataTable dt = default;
            DataTable back = default;
            using (var Excel = excel.UseExcelFile(options: new UseOptions { Path = "data\\excel\\Sample.xlsx", SaveChanges = true, CreateIfNotExist = true, ReadOnly = true }))
            {
                dt = Excel.Sheet["Sheet1"].Range["A1:B4"].ReadRange(hasHeaders: true, visibleRowsOnly: false);
            }
            using (var Excel = excel.UseExcelFile(options: new UseOptions { Path = "output\\WriteRangeX_Min.xlsx", SaveChanges = true, CreateIfNotExist = true }))
            {
                Excel.Sheet["Sheet1"].Range["B2"].WriteRange(source: dt, append: false, excludeHeaders: false);
                back = Excel.Sheet["Sheet1"].Range["B2:C5"].ReadRange(hasHeaders: true, visibleRowsOnly: false);
            }
            Log(message: "書いた行数: " + back.Rows.Count.ToString(), level: UiPath.CodedWorkflows.LogLevel.Info);
            Log(message: "最後の行: " + back.Rows[2]["Name"].ToString() + " " + back.Rows[2]["Age"].ToString(), level: UiPath.CodedWorkflows.LogLevel.Info);
        }
    }
}
