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
    // tools/ir/gen-coded.ts で IR（InsertExcelChartX_Line）から生成。手で直さず IR を直す
    public class InsertExcelChartX_Line : CodedWorkflow
    {
        [Workflow]
        public void Execute()
        {
            UiPath.Excel.IChartRef ch = default;
            // 元のブックを output に写す
            system.CopyFile(path: "data\\excel\\Sample.xlsx", destination: "output\\InsertExcelChartX_Line.xlsx", overwrite: true);
            using (var Excel = excel.UseExcelFile(options: new UseOptions { Path = "output\\InsertExcelChartX_Line.xlsx", SaveChanges = true, CreateIfNotExist = true, ResizeWindow = UiPath.Excel.Model.ResizeWindowOptions.None }))
            {
                ch = Excel.Sheet["Sheet1"].Range["A1:B4"].InsertExcelChart(sheet: Excel.Sheet["Sheet1"], chartCategory: UiPath.Excel.ExcelChartCategory.Line, chartType: UiPath.Excel.ExcelChartType.xlLineMarkers, left: 300, top: 10, width: 400, height: 300);
                Log(message: "種類: " + ch.ChartInfo.ChartType.ToString(), level: UiPath.CodedWorkflows.LogLevel.Info);
            }
        }
    }
}
