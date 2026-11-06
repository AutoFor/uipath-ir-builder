using System;
using System.Collections.Generic;
using System.Data;
using System.IO;
using System.Linq;
using UiPath.CodedWorkflows;
using UiPath.Platform.ResourceHandling;

namespace CatalogProbeNet8
{
    // tools/ir/gen-coded.ts で IR（SetToClipboard_Full）から生成。手で直さず IR を直す
    public class SetToClipboard_Full : CodedWorkflow
    {
        [Workflow]
        public void Execute()
        {
            Object got = default;
            // クリップボードに入れる（全部入り）
            // SetToClipboard はCoded API が無い（Coded API なし（Classic のクリップボード操作。Coded の uiAutomation.SetClipboard は Modern（NSetClipboard）のオプションで、Classic とは対応しない））ので XAML 経由（coded/_activities/SetToClipboard_78a2b8.xaml）
            RunWorkflow("coded/_activities/SetToClipboard_78a2b8.xaml", new Dictionary<string, object> { ["in_ContinueOnError"] = false, ["in_Text"] = "uia-c5 clipboard full" });
            // クリップボードから読み戻す
            // GetFromClipboard はCoded API が無い（Coded API なし（Classic のクリップボード操作。Coded の uiAutomation.GetClipboard は Modern（NGetClipboard）のオプションで、Classic の Result（Object）・TimeoutMS とは対応しない））ので XAML 経由（coded/_activities/GetFromClipboard_bdb3ee.xaml）
            var __xaml1 = RunWorkflow("coded/_activities/GetFromClipboard_bdb3ee.xaml", null);
            got = (Object)__xaml1["out_Result"];
            Log(message: "クリップボード: " + Convert.ToString(got), level: UiPath.CodedWorkflows.LogLevel.Info);
        }
    }
}
