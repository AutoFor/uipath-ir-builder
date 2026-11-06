using System;
using System.Collections.Generic;
using System.Data;
using System.IO;
using System.Linq;
using UiPath.CodedWorkflows;
using UiPath.Platform.ResourceHandling;

namespace CatalogProbeNet8
{
    // tools/ir/gen-coded.ts で IR（InvokeCode_Min）から生成。手で直さず IR を直す
    public class InvokeCode_Min : CodedWorkflow
    {
        [Workflow]
        public void Execute()
        {
            Int32 y = default;
            // InvokeCode はCoded API が無い（Coded では C# をそのまま書くので InvokeCode は要らない）ので XAML 経由（coded/_xaml/InvokeCode_Min_1.xaml）
            var __xaml1 = RunWorkflow("coded/_xaml/InvokeCode_Min_1.xaml", new Dictionary<string, object> { ["y"] = y });
            y = (Int32)__xaml1["y"];
            Log(message: "y=" + y.ToString(), level: UiPath.CodedWorkflows.LogLevel.Info);
        }
    }
}
