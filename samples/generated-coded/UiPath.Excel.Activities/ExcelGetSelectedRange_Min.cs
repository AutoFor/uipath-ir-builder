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
    // tools/ir/gen-coded.ts で IR（ExcelGetSelectedRange_Min）から生成。手で直さず IR を直す
    public class ExcelGetSelectedRange_Min : CodedWorkflow
    {
        [Workflow]
        public void Execute()
        {
            String addr = default;
            // ExcelApplicationScope は中に Coded API の無いアクティビティがあり、それだけをスコープの外に出せないので XAML 経由（coded/_xaml/ExcelGetSelectedRange_Min_1.xaml）
            var __xaml2 = RunWorkflow("coded/_xaml/ExcelGetSelectedRange_Min_1.xaml", new Dictionary<string, object> { ["addr"] = addr });
            addr = (String)__xaml2["addr"];
            Log(message: "selected: " + addr, level: UiPath.CodedWorkflows.LogLevel.Info);
        }
    }
}
