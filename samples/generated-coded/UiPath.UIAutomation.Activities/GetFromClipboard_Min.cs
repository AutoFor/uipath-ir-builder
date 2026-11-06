using System;
using System.Collections.Generic;
using System.Data;
using System.IO;
using System.Linq;
using UiPath.CodedWorkflows;
using UiPath.Platform.ResourceHandling;

namespace CatalogProbeNet8
{
    // tools/ir/gen-coded.ts で IR（GetFromClipboard_Min）から生成。手で直さず IR を直す
    public class GetFromClipboard_Min : CodedWorkflow
    {
        [Workflow]
        public void Execute()
        {
            Object got = default;
            // テスト用の文字列を入れる
            // SetToClipboard はCoded API が無い（Coded API なし（Classic のクリップボード操作。Coded の uiAutomation.SetClipboard は Modern（NSetClipboard）のオプションで、Classic とは対応しない））ので XAML 経由（coded/_xaml/GetFromClipboard_Min_1.xaml）
            RunWorkflow("coded/_xaml/GetFromClipboard_Min_1.xaml", null);
            // クリップボードから読む
            // GetFromClipboard はCoded API が無い（Coded API なし（Classic のクリップボード操作。Coded の uiAutomation.GetClipboard は Modern（NGetClipboard）のオプションで、Classic の Result（Object）・TimeoutMS とは対応しない））ので XAML 経由（coded/_xaml/GetFromClipboard_Min_2.xaml）
            var __xaml1 = RunWorkflow("coded/_xaml/GetFromClipboard_Min_2.xaml", new Dictionary<string, object> { ["got"] = got });
            got = (Object)__xaml1["got"];
            Log(message: "クリップボード: " + Convert.ToString(got), level: UiPath.CodedWorkflows.LogLevel.Info);
        }
    }
}
