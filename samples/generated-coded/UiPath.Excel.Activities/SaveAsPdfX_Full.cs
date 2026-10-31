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
    // tools/ir/gen-coded.ts で IR（SaveAsPdfX_Full）から生成。手で直さず IR を直す
    public class SaveAsPdfX_Full : CodedWorkflow
    {
        [Workflow]
        public void Execute()
        {
            // 元のブックを output に写す
            system.CopyFile(path: "data\\excel\\Sample.xlsx", destination: "output\\SaveAsPdfX_Full.xlsx", overwrite: true);
            using (var Excel = excel.UseExcelFile(options: new UseOptions { Path = "output\\SaveAsPdfX_Full.xlsx", SaveChanges = true, CreateIfNotExist = true, ReadOnly = true, ResizeWindow = UiPath.Excel.Model.ResizeWindowOptions.None }))
            {
                // 1 ページ目だけ PDF
                Excel.SaveAsPdf(filePath: "output\\SaveAsPdfX_Full.pdf", replaceExisting: true, startPage: 1, endPage: 1, saveQuality: UiPath.Excel.PdfSaveQuality.MinimumQuality);
            }
            Log(message: Convert.ToString("PDF: " + System.IO.File.Exists(@"output\SaveAsPdfX_Full.pdf").ToString() + " " + System.Text.Encoding.ASCII.GetString(System.IO.File.ReadAllBytes(@"output\SaveAsPdfX_Full.pdf"), 0, 4) + " " + (System.IO.File.ReadAllBytes(@"output\SaveAsPdfX_Full.pdf").Length > 0).ToString()), level: UiPath.CodedWorkflows.LogLevel.Info);
        }
    }
}
