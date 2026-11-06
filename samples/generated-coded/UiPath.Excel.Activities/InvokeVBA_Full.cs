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
    // tools/ir/gen-coded.ts で IR（InvokeVBA_Full）から生成。手で直さず IR を直す
    public class InvokeVBA_Full : CodedWorkflow
    {
        [Workflow]
        public void Execute()
        {
            Object res = default;
            using (var ExcelWorkbookScope = excel.UseWorkBook(options: new WorkbookOptions { Path = "data\\excel\\Sample.xlsx", CreateNew = true }))
            {
                // VBA を実行
                // InvokeVBA はCoded API が無い（Coded API なし（InvokeVBA は IWorkbookQuickHandle 用で、クラシックの IWorkHandle（UseWorkBook は Excel を起動しない）からは呼べない。モダンは InvokeVBAX））ので XAML 経由（coded/_xaml/InvokeVBA_Full_1.xaml）
                var __xaml1 = RunWorkflow("coded/_xaml/InvokeVBA_Full_1.xaml", new Dictionary<string, object> { ["res"] = res });
                res = (Object)__xaml1["res"];
            }
            Log(message: "vba: " + Convert.ToString(res), level: UiPath.CodedWorkflows.LogLevel.Info);
        }
    }
}
