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
            // TextToLeftRight はCoded API が無い（Coded API なし（ISystemService に該当するメソッドが無い））ので XAML 経由（coded/_activities/TextToLeftRight_0a032b.xaml）
            var __xaml1 = RunWorkflow("coded/_activities/TextToLeftRight_0a032b.xaml", new Dictionary<string, object> { ["in_FullText"] = "left,right", ["in_Separator"] = "," });
            l = (System.String)__xaml1["out_TextToLeft"];
            r = (System.String)__xaml1["out_TextToRight"];
            // 大文字小文字を区別せずに分ける
            // TextToLeftRight はCoded API が無い（Coded API なし（ISystemService に該当するメソッドが無い））ので XAML 経由（coded/_activities/TextToLeftRight_0e6d65.xaml）
            var __xaml2 = RunWorkflow("coded/_activities/TextToLeftRight_0e6d65.xaml", new Dictionary<string, object> { ["in_FullText"] = "leftxright", ["in_Separator"] = "x" });
            l2 = (System.String)__xaml2["out_TextToLeft"];
            r2 = (System.String)__xaml2["out_TextToRight"];
            Log(message: l, level: UiPath.CodedWorkflows.LogLevel.Info);
            Log(message: r, level: UiPath.CodedWorkflows.LogLevel.Info);
            Log(message: l2, level: UiPath.CodedWorkflows.LogLevel.Info);
            Log(message: r2, level: UiPath.CodedWorkflows.LogLevel.Info);
        }
    }
}
