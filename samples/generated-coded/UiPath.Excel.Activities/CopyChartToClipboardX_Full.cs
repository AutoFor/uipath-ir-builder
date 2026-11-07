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
    // tools/ir/gen-coded.ts で IR（CopyChartToClipboardX_Full）から生成。手で直さず IR を直す
    public class CopyChartToClipboardX_Full : CodedWorkflow
    {
        [Workflow]
        public void Execute()
        {
            UiPath.Excel.IChartRef ch = default;
            // 元のブックを output に写す
            system.CopyFile(path: "data\\excel\\Sample.xlsx", destination: "output\\CopyChartToClipboardX_Full.xlsx", overwrite: true);
            using (var Excel = excel.UseExcelFile(options: new UseOptions { Path = "output\\CopyChartToClipboardX_Full.xlsx", SaveChanges = true, CreateIfNotExist = true, ResizeWindow = UiPath.Excel.Model.ResizeWindowOptions.None }))
            {
                ch = Excel.Sheet["Sheet1"].Range["A1:B4"].InsertExcelChart(sheet: Excel.Sheet["Sheet1"], chartCategory: UiPath.Excel.ExcelChartCategory.Column, chartType: UiPath.Excel.ExcelChartType.xlColumnClustered, left: 300, top: 10, width: 400, height: 300);
                // 画像に保存
                ch.GetChart(action: UiPath.Excel.ExcelChartAction.SaveAsPicture, fileName: "output\\CopyChartToClipboardX_Full.png", replaceFile: true);
            }
            Log(message: "画像: " + System.IO.File.Exists("output\\CopyChartToClipboardX_Full.png").ToString(), level: UiPath.CodedWorkflows.LogLevel.Info);
        }
    }
}
