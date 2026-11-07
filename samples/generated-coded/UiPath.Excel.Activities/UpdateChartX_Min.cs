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
    // tools/ir/gen-coded.ts で IR（UpdateChartX_Min）から生成。手で直さず IR を直す
    public class UpdateChartX_Min : CodedWorkflow
    {
        [Workflow]
        public void Execute()
        {
            UiPath.Excel.IChartRef ch = default;
            // 元のブックを output に写す
            system.CopyFile(path: "data\\excel\\Sample.xlsx", destination: "output\\UpdateChartX_Min.xlsx", overwrite: true);
            using (var Excel = excel.UseExcelFile(options: new UseOptions { Path = "output\\UpdateChartX_Min.xlsx", SaveChanges = true, CreateIfNotExist = true, ResizeWindow = UiPath.Excel.Model.ResizeWindowOptions.None }))
            {
                ch = Excel.Sheet["Sheet1"].Range["A1:B4"].InsertExcelChart(sheet: Excel.Sheet["Sheet1"], chartCategory: UiPath.Excel.ExcelChartCategory.Column, chartType: UiPath.Excel.ExcelChartType.xlColumnClustered, left: 300, top: 10, width: 400, height: 300);
                // UpdateChartX はCoded API が無い（Coded API なし（UpdateChart はクラシックの IWorkHandle にしか無く、モダンの IChartRef を渡す形が無い。1回に1種類の変更しか渡せず、複数の子も表せない））ので XAML 経由（coded/_xaml/UpdateChartX_Min_1.xaml）
                RunWorkflow("coded/_xaml/UpdateChartX_Min_1.xaml", new Dictionary<string, object> { ["ch"] = ch });
                Log(message: "題名: " + ch.ChartInfo.Title, level: UiPath.CodedWorkflows.LogLevel.Info);
            }
        }
    }
}
