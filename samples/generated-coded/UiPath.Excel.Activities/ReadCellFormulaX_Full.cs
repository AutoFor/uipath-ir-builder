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
    // tools/ir/gen-coded.ts で IR（ReadCellFormulaX_Full）から生成。手で直さず IR を直す
    public class ReadCellFormulaX_Full : CodedWorkflow
    {
        [Workflow]
        public void Execute()
        {
            String f = default;
            String g = default;
            using (var Excel = excel.UseExcelFile(options: new UseOptions { Path = "data\\excel\\Sample.xlsx", SaveChanges = true, CreateIfNotExist = true, ReadOnly = true, ResizeWindow = UiPath.Excel.Model.ResizeWindowOptions.None }))
            {
                // C3 の式
                // ReadCellFormulaX はCoded API が無い（Coded API なし（ReadCellFormula は IWorkHandle＝クラシックの UseWorkBook 用。モダンの UseExcelFile が返す IReadCellRef に対する式の読み取りは無い））ので XAML 経由（coded/_activities/ReadCellFormulaX_44914e.xaml）
                var __xaml1 = RunWorkflow("coded/_activities/ReadCellFormulaX_44914e.xaml", new Dictionary<string, object> { ["in_Cell"] = Excel.Sheet["Sheet1"].Cell["C3"] });
                f = (System.String)__xaml1["out_SaveTo"];
                // 値のセルの式
                // ReadCellFormulaX はCoded API が無い（Coded API なし（ReadCellFormula は IWorkHandle＝クラシックの UseWorkBook 用。モダンの UseExcelFile が返す IReadCellRef に対する式の読み取りは無い））ので XAML 経由（coded/_activities/ReadCellFormulaX_44914e.xaml）
                var __xaml2 = RunWorkflow("coded/_activities/ReadCellFormulaX_44914e.xaml", new Dictionary<string, object> { ["in_Cell"] = Excel.Sheet["Sheet1"].Cell["B3"] });
                g = (System.String)__xaml2["out_SaveTo"];
            }
            Log(message: "C3 の式: " + f, level: UiPath.CodedWorkflows.LogLevel.Info);
            Log(message: "B3 の式: " + g, level: UiPath.CodedWorkflows.LogLevel.Info);
        }
    }
}
