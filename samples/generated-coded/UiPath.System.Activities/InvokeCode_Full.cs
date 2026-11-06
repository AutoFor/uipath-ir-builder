using System;
using System.Collections.Generic;
using System.Data;
using System.IO;
using System.Linq;
using UiPath.CodedWorkflows;
using UiPath.Platform.ResourceHandling;

namespace CatalogProbeNet8
{
    // tools/ir/gen-coded.ts で IR（InvokeCode_Full）から生成。手で直さず IR を直す
    public class InvokeCode_Full : CodedWorkflow
    {
        [Workflow]
        public void Execute()
        {
            String name = "world";
            String greeting = default;
            Int32 count = 1;
            // C# のコードを呼ぶ
            // InvokeCode はCoded API が無い（Coded では C# をそのまま書くので InvokeCode は要らない）ので XAML 経由（coded/_xaml/InvokeCode_Full_1.xaml）
            var __xaml1 = RunWorkflow("coded/_xaml/InvokeCode_Full_1.xaml", new Dictionary<string, object> { ["name"] = name, ["greeting"] = greeting, ["count"] = count });
            greeting = (String)__xaml1["greeting"];
            count = (Int32)__xaml1["count"];
            Log(message: greeting, level: UiPath.CodedWorkflows.LogLevel.Info);
            Log(message: "count=" + count.ToString(), level: UiPath.CodedWorkflows.LogLevel.Info);
            // VB のコードを呼ぶ
            // InvokeCode はCoded API が無い（Coded では C# をそのまま書くので InvokeCode は要らない）ので XAML 経由（coded/_xaml/InvokeCode_Full_2.xaml）
            var __xaml2 = RunWorkflow("coded/_xaml/InvokeCode_Full_2.xaml", new Dictionary<string, object> { ["name"] = name, ["greeting"] = greeting });
            greeting = (String)__xaml2["greeting"];
            Log(message: greeting, level: UiPath.CodedWorkflows.LogLevel.Info);
        }
    }
}
