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
    // tools/ir/gen-coded.ts で IR（GetCellColorX_Min）から生成。手で直さず IR を直す
    public class GetCellColorX_Min : CodedWorkflow
    {
        [Workflow]
        public void Execute()
        {
            System.Drawing.Color c = default;
            using (var Excel = excel.UseExcelFile(options: new UseOptions { Path = "data\\excel\\Sample.xlsx", SaveChanges = true, CreateIfNotExist = true, ReadOnly = true }))
            {
                c = Excel.Sheet["Sheet1"].Cell["A1"].GetCellColorInternal();
            }
            Log(message: "RGB=" + c.R.ToString() + "," + c.G.ToString() + "," + c.B.ToString(), level: UiPath.CodedWorkflows.LogLevel.Info);
        }
    }
}
