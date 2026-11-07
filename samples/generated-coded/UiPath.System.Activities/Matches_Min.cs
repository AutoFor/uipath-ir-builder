using System;
using System.Collections.Generic;
using System.Data;
using System.IO;
using System.Linq;
using UiPath.CodedWorkflows;
using UiPath.Platform.ResourceHandling;

namespace CatalogProbeNet8
{
    // tools/ir/gen-coded.ts で IR（Matches_Min）から生成。手で直さず IR を直す
    public class Matches_Min : CodedWorkflow
    {
        [Workflow]
        public void Execute()
        {
            IEnumerable<System.Text.RegularExpressions.Match> ms = default;
            // Matches はCoded API が無い（Coded API なし（ISystemService に Matches が無い。正規表現は System.Text.RegularExpressions.Regex で書ける））ので XAML 経由（coded/_activities/Matches.xaml）
            var __xaml1 = RunWorkflow("coded/_activities/Matches.xaml", new Dictionary<string, object> { ["in_Input"] = "a1b22c333", ["in_Pattern"] = "\\d+" });
            ms = (System.Collections.Generic.IEnumerable<System.Text.RegularExpressions.Match>)__xaml1["out_Result"];
            Log(message: Convert.ToString(ms.Count().ToString()), level: UiPath.CodedWorkflows.LogLevel.Info);
        }
    }
}
