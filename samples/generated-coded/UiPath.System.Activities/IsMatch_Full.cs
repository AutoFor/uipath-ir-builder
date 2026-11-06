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
            // IsMatch はCoded API が無い（Coded API なし（ISystemService に IsMatch が無い。正規表現は System.Text.RegularExpressions.Regex で書ける））ので XAML 経由（coded/_xaml/IsMatch_Full_1.xaml）
            var __xaml1 = RunWorkflow("coded/_xaml/IsMatch_Full_1.xaml", new Dictionary<string, object> { ["a"] = a });
            a = (Boolean)__xaml1["a"];
            // 大文字小文字を区別する
            // IsMatch はCoded API が無い（Coded API なし（ISystemService に IsMatch が無い。正規表現は System.Text.RegularExpressions.Regex で書ける））ので XAML 経由（coded/_xaml/IsMatch_Full_2.xaml）
            var __xaml2 = RunWorkflow("coded/_xaml/IsMatch_Full_2.xaml", new Dictionary<string, object> { ["b"] = b });
            b = (Boolean)__xaml2["b"];
            Log(message: a.ToString(), level: UiPath.CodedWorkflows.LogLevel.Info);
            Log(message: b.ToString(), level: UiPath.CodedWorkflows.LogLevel.Info);
        }
    }
}
