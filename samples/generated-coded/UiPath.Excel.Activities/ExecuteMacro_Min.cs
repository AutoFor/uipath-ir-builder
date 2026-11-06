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
    // tools/ir/gen-coded.ts で IR（ExecuteMacro_Min）から生成。手で直さず IR を直す
    public class ExecuteMacro_Min : CodedWorkflow
    {
        [Workflow]
        public void Execute()
        {
            Object res = default;
            using (var ExcelWorkbookScope = excel.UseWorkBook(options: new WorkbookOptions { Path = "data\\excel\\Sample.xlsx", CreateNew = true }))
            {
                // ExecuteMacro はCoded API が無い（Coded API なし（ExecuteMacro は IWorkbookQuickHandle 用で、クラシックの IWorkHandle（UseWorkBook は Excel を起動しない）からは呼べない。モダンは ExecuteMacroX））ので XAML 経由（coded/_xaml/ExecuteMacro_Min_1.xaml）
                RunWorkflow("coded/_xaml/ExecuteMacro_Min_1.xaml", null);
            }
        }
    }
}
