using System;
using System.Collections.Generic;
using System.Data;
using System.IO;
using System.Linq;
using UiPath.CodedWorkflows;
using UiPath.Platform.ResourceHandling;

namespace CatalogProbeNet8
{
    // tools/ir/gen-coded.ts で IR（ExecuteXPath_Min）から生成。手で直さず IR を直す
    public class ExecuteXPath_Min : CodedWorkflow
    {
        [Workflow]
        public void Execute()
        {
            Object res = default;
            // ExecuteXPath は対応表が無いので XAML 経由（coded/_xaml/ExecuteXPath_Min_1.xaml）
            var __xaml1 = RunWorkflow("coded/_xaml/ExecuteXPath_Min_1.xaml", new Dictionary<string, object> { ["res"] = res });
            res = (Object)__xaml1["res"];
            Log(message: "count=" + res.ToString(), level: UiPath.CodedWorkflows.LogLevel.Info);
        }
    }
}
