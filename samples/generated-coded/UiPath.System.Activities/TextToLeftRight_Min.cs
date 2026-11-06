using System;
using System.Collections.Generic;
using System.Data;
using System.IO;
using System.Linq;
using UiPath.CodedWorkflows;
using UiPath.Platform.ResourceHandling;

namespace CatalogProbeNet8
{
    // tools/ir/gen-coded.ts で IR（TextToLeftRight_Min）から生成。手で直さず IR を直す
    public class TextToLeftRight_Min : CodedWorkflow
    {
        [Workflow]
        public void Execute()
        {
            String l = default;
            String r = default;
            // TextToLeftRight はCoded API が無い（Coded API なし（ISystemService に該当するメソッドが無い））ので XAML 経由（coded/_xaml/TextToLeftRight_Min_1.xaml）
            var __xaml1 = RunWorkflow("coded/_xaml/TextToLeftRight_Min_1.xaml", new Dictionary<string, object> { ["l"] = l, ["r"] = r });
            l = (String)__xaml1["l"];
            r = (String)__xaml1["r"];
            Log(message: l, level: UiPath.CodedWorkflows.LogLevel.Info);
            Log(message: r, level: UiPath.CodedWorkflows.LogLevel.Info);
        }
    }
}
