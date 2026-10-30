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
    // tools/ir/gen-coded.ts で IR（CopyChartToClipboardX_Min）から生成。手で直さず IR を直す
    public class CopyChartToClipboardX_Min : CodedWorkflow
    {
        [Workflow]
        public void Execute()
        {
            IChartRef ch = default;
            // 元のブックを output に写す
            system.CopyFile(path: "data\\excel\\Sample.xlsx", destination: "output\\CopyChartToClipboardX_Min.xlsx", overwrite: true);
            using (var Excel = excel.UseExcelFile(options: new UseOptions { Path = "output\\CopyChartToClipboardX_Min.xlsx", SaveChanges = true, CreateIfNotExist = true }))
            {
                ch = Excel.Sheet["Sheet1"].Range["A1:B4"].InsertExcelChart(sheet: Excel.Sheet["Sheet1"], chartCategory: UiPath.Excel.ExcelChartCategory.Column, chartType: UiPath.Excel.ExcelChartType.xlColumnClustered, left: 300, top: 10, width: 400, height: 300);
                ch.GetChart();
                Log(message: "コピーした", level: UiPath.CodedWorkflows.LogLevel.Info);
            }
        }
    }
}
