using System;
using System.Collections.Generic;
using System.Data;
using System.IO;
using System.Linq;
using UiPath.CodedWorkflows;
using UiPath.Platform.ResourceHandling;

namespace CatalogProbeNet8
{
    // tools/ir/gen-coded.ts で IR（TextToLeftRight_Full）から生成。手で直さず IR を直す
    public class TextToLeftRight_Full : CodedWorkflow
    {
        [Workflow]
        public void Execute()
        {
            String l = default;
            String r = default;
            String l2 = default;
            String r2 = default;
            // カンマで左右に分ける
            // TextToLeftRight はCoded API が無い（Coded API なし（ISystemService に該当するメソッドが無い））ので XAML 経由（coded/_xaml/TextToLeftRight_Full_1.xaml）
            var __xaml1 = RunWorkflow("coded/_xaml/TextToLeftRight_Full_1.xaml", new Dictionary<string, object> { ["l"] = l, ["r"] = r });
            l = (String)__xaml1["l"];
            r = (String)__xaml1["r"];
            // 大文字小文字を区別せずに分ける
            // TextToLeftRight はCoded API が無い（Coded API なし（ISystemService に該当するメソッドが無い））ので XAML 経由（coded/_xaml/TextToLeftRight_Full_2.xaml）
            var __xaml2 = RunWorkflow("coded/_xaml/TextToLeftRight_Full_2.xaml", new Dictionary<string, object> { ["l2"] = l2, ["r2"] = r2 });
            l2 = (String)__xaml2["l2"];
            r2 = (String)__xaml2["r2"];
            Log(message: l, level: UiPath.CodedWorkflows.LogLevel.Info);
            Log(message: r, level: UiPath.CodedWorkflows.LogLevel.Info);
            Log(message: l2, level: UiPath.CodedWorkflows.LogLevel.Info);
            Log(message: r2, level: UiPath.CodedWorkflows.LogLevel.Info);
        }
    }
}
