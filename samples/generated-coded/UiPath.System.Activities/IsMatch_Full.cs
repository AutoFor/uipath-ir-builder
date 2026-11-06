using System;
using System.Collections.Generic;
using System.Data;
using System.IO;
using System.Linq;
using UiPath.CodedWorkflows;
using UiPath.Platform.ResourceHandling;

namespace CatalogProbeNet8
{
    // tools/ir/gen-coded.ts で IR（IsMatch_Full）から生成。手で直さず IR を直す
    public class IsMatch_Full : CodedWorkflow
    {
        [Workflow]
        public void Execute()
        {
            Boolean a = default;
            Boolean b = default;
            // 大文字小文字を区別しない
            // IsMatch はCoded API が無い（Coded API なし（ISystemService に IsMatch が無い。正規表現は System.Text.RegularExpressions.Regex で書ける））ので XAML 経由（coded/_activities/IsMatch_cbb0b7.xaml）
            var __xaml1 = RunWorkflow("coded/_activities/IsMatch_cbb0b7.xaml", new Dictionary<string, object> { ["in_Input"] = "ABC123", ["in_Pattern"] = "^[a-z]+\\d+$", ["in_TimeoutMS"] = 5000 });
            a = (System.Boolean)__xaml1["out_Result"];
            // 大文字小文字を区別する
            // IsMatch はCoded API が無い（Coded API なし（ISystemService に IsMatch が無い。正規表現は System.Text.RegularExpressions.Regex で書ける））ので XAML 経由（coded/_activities/IsMatch_f36fae.xaml）
            var __xaml2 = RunWorkflow("coded/_activities/IsMatch_f36fae.xaml", new Dictionary<string, object> { ["in_Input"] = "ABC123", ["in_Pattern"] = "^[a-z]+\\d+$" });
            b = (System.Boolean)__xaml2["out_Result"];
            Log(message: a.ToString(), level: UiPath.CodedWorkflows.LogLevel.Info);
            Log(message: b.ToString(), level: UiPath.CodedWorkflows.LogLevel.Info);
        }
    }
}
