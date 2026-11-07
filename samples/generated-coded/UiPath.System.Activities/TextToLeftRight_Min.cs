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
            // TextToLeftRight はCoded API が無い（Coded API なし（ISystemService に該当するメソッドが無い））ので XAML 経由（coded/_activities/TextToLeftRight.xaml）
            var __xaml1 = RunWorkflow("coded/_activities/TextToLeftRight.xaml", new Dictionary<string, object> { ["in_FullText"] = "key=value", ["in_Separator"] = "=" });
            l = (System.String)__xaml1["out_TextToLeft"];
            r = (System.String)__xaml1["out_TextToRight"];
            Log(message: l, level: UiPath.CodedWorkflows.LogLevel.Info);
            Log(message: r, level: UiPath.CodedWorkflows.LogLevel.Info);
        }
    }
}
