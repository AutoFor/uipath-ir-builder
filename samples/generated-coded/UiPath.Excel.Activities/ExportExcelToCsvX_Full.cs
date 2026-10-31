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
    // tools/ir/gen-coded.ts で IR（ExportExcelToCsvX_Full）から生成。手で直さず IR を直す
    public class ExportExcelToCsvX_Full : CodedWorkflow
    {
        [Workflow]
        public void Execute()
        {
            String txt = default;
            // 元のブックを output に写す
            system.CopyFile(path: "data\\excel\\Sample.xlsx", destination: "output\\ExportExcelToCsvX_Full.xlsx", overwrite: true);
            using (var Excel = excel.UseExcelFile(options: new UseOptions { Path = "output\\ExportExcelToCsvX_Full.xlsx", SaveChanges = true, CreateIfNotExist = true, ReadOnly = true, ResizeWindow = UiPath.Excel.Model.ResizeWindowOptions.None }))
            {
                // Sheet1 を CSV に
                Excel.Sheet["Sheet1"].Range["A1:C4"].ExportExcelToSCV(fileName: "output\\ExportExcelToCsvX_Full.csv");
            }
            txt = system.ReadTextFile(file: LocalResource.FromPath("output\\ExportExcelToCsvX_Full.csv"));
            Log(message: Convert.ToString("CSV: " + txt.Replace("\r", "").Replace("\n", "|")), level: UiPath.CodedWorkflows.LogLevel.Info);
        }
    }
}
