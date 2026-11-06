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
    // tools/ir/gen-coded.ts で IR（ExecuteMacro_Full）から生成。手で直さず IR を直す
    public class ExecuteMacro_Full : CodedWorkflow
    {
        [Workflow]
        public void Execute()
        {
            Object res = default;
            using (var ExcelWorkbookScope = excel.UseWorkBook(options: new WorkbookOptions { Path = "data\\excel\\Sample.xlsx", CreateNew = true }))
            {
                // マクロを実行
                // ExecuteMacro はCoded API が無い（Coded API なし（ExecuteMacro は IWorkbookQuickHandle 用で、クラシックの IWorkHandle（UseWorkBook は Excel を起動しない）からは呼べない。モダンは ExecuteMacroX））ので XAML 経由（coded/_activities/ExecuteMacro_ba0365.xaml）
                var __xaml1 = RunWorkflow("coded/_activities/ExecuteMacro_ba0365.xaml", new Dictionary<string, object> { ["in_ContinueOnError"] = true, ["in_MacroName"] = "Module1.ExcelD_Add", ["in_MacroParameters"] = new Object[] { 2, 3 } });
                res = (System.Object)__xaml1["out_MacroOutput"];
            }
            Log(message: "macro: " + Convert.ToString(res), level: UiPath.CodedWorkflows.LogLevel.Info);
        }
    }
}
