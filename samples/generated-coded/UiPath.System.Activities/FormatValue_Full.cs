using System;
using System.Collections.Generic;
using System.Data;
using System.IO;
using System.Linq;
using UiPath.CodedWorkflows;
using UiPath.Platform.ResourceHandling;

namespace CatalogProbeNet8
{
    // tools/ir/gen-coded.ts で IR（FormatValue_Full）から生成。手で直さず IR を直す
    public class FormatValue_Full : CodedWorkflow
    {
        [Workflow]
        public void Execute()
        {
            UiPath.Core.GenericValue a = default;
            UiPath.Core.GenericValue b = default;
            UiPath.Core.GenericValue c = default;
            a = 1234567.891;
            // 桁区切りを入れ替える
            // FormatValue はCoded API が無い（Coded API なし（ISystemService に該当するメソッドが無い））ので XAML 経由（coded/_activities/FormatValue_78cf99.xaml）
            var __xaml1 = RunWorkflow("coded/_activities/FormatValue_78cf99.xaml", new Dictionary<string, object> { ["io_Value"] = a });
            a = (UiPath.Core.GenericValue)__xaml1["io_Value"];
            b = new DateTime(2024, 1, 31);
            // 日付の書式
            // FormatValue はCoded API が無い（Coded API なし（ISystemService に該当するメソッドが無い））ので XAML 経由（coded/_activities/FormatValue_2926d1.xaml）
            var __xaml2 = RunWorkflow("coded/_activities/FormatValue_2926d1.xaml", new Dictionary<string, object> { ["io_Value"] = b });
            b = (UiPath.Core.GenericValue)__xaml2["io_Value"];
            c = 0.256;
            // パーセント
            // FormatValue はCoded API が無い（Coded API なし（ISystemService に該当するメソッドが無い））ので XAML 経由（coded/_activities/FormatValue_a4a042.xaml）
            var __xaml3 = RunWorkflow("coded/_activities/FormatValue_a4a042.xaml", new Dictionary<string, object> { ["io_Value"] = c });
            c = (UiPath.Core.GenericValue)__xaml3["io_Value"];
            Log(message: a.ToString(), level: UiPath.CodedWorkflows.LogLevel.Info);
            Log(message: b.ToString(), level: UiPath.CodedWorkflows.LogLevel.Info);
            Log(message: c.ToString(), level: UiPath.CodedWorkflows.LogLevel.Info);
        }
    }
}
