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
            // InvokeCode はCoded API が無い（Coded では C# をそのまま書くので InvokeCode は要らない）ので XAML 経由（coded/_activities/InvokeCode_41ae28.xaml）
            var __xaml1 = RunWorkflow("coded/_activities/InvokeCode_41ae28.xaml", new Dictionary<string, object> { ["in_ContinueOnError"] = false, ["io_Arguments_counter"] = count, ["in_Arguments_who"] = name });
            count = (Int32)__xaml1["io_Arguments_counter"];
            greeting = (String)__xaml1["out_Arguments_greeting"];
            Log(message: greeting, level: UiPath.CodedWorkflows.LogLevel.Info);
            Log(message: "count=" + count.ToString(), level: UiPath.CodedWorkflows.LogLevel.Info);
            // VB のコードを呼ぶ
            // InvokeCode はCoded API が無い（Coded では C# をそのまま書くので InvokeCode は要らない）ので XAML 経由（coded/_activities/InvokeCode_d45e2e.xaml）
            var __xaml2 = RunWorkflow("coded/_activities/InvokeCode_d45e2e.xaml", new Dictionary<string, object> { ["in_Arguments_who"] = name });
            greeting = (String)__xaml2["out_Arguments_greeting"];
            Log(message: greeting, level: UiPath.CodedWorkflows.LogLevel.Info);
        }
    }
}
