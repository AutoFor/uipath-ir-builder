using System;
using System.Collections.Generic;
using System.Data;
using System.IO;
using System.Linq;
using UiPath.CodedWorkflows;
using UiPath.Platform.ResourceHandling;

namespace CatalogProbeNet8
{
    // tools/ir/gen-coded.ts で IR（Matches_Full）から生成。手で直さず IR を直す
    public class Matches_Full : CodedWorkflow
    {
        [Workflow]
        public void Execute()
        {
            IEnumerable<System.Text.RegularExpressions.Match> ms = default;
            String first = default;
            // 文字と数字の組を全部探す
            // Matches はCoded API が無い（Coded API なし（ISystemService に Matches が無い。正規表現は System.Text.RegularExpressions.Regex で書ける））ので XAML 経由（coded/_activities/Matches_1d1fed.xaml）
            var __xaml1 = RunWorkflow("coded/_activities/Matches_1d1fed.xaml", new Dictionary<string, object> { ["in_Input"] = "A1b22C333", ["in_Pattern"] = "[a-z]\\d+", ["in_TimeoutMS"] = 5000 });
            first = (System.String)__xaml1["out_FirstMatch"];
            ms = (System.Collections.Generic.IEnumerable<System.Text.RegularExpressions.Match>)__xaml1["out_Result"];
            Log(message: Convert.ToString(ms.Count().ToString()), level: UiPath.CodedWorkflows.LogLevel.Info);
            Log(message: first, level: UiPath.CodedWorkflows.LogLevel.Info);
        }
    }
}
