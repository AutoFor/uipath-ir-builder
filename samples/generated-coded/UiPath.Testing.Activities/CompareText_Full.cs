using System;
using System.Collections.Generic;
using System.Data;
using System.IO;
using System.Linq;
using UiPath.CodedWorkflows;
using UiPath.Platform.ResourceHandling;

namespace CatalogProbeNet8
{
    // tools/ir/gen-coded.ts で IR（CompareText_Full）から生成。手で直さず IR を直す
    public class CompareText_Full : CodedWorkflow
    {
        [Workflow]
        public void Execute()
        {
            UiPath.Testing.Activities.Models.ComparisonRule rule = default;
            Boolean withRule = default;
            Boolean plain = default;
            IEnumerable<UiPath.Testing.Activities.Models.Difference> diffs = default;
            String outPath = System.IO.Path.Combine(System.IO.Path.GetTempPath(), "uta-compare-text-full.html");
            // 数字を無視する規則
            // CreateComparisonRule は対応表が無いので XAML 経由（coded/_activities/CreateComparisonRule_cbece0.xaml）
            var __xaml1 = RunWorkflow("coded/_activities/CreateComparisonRule_cbece0.xaml", new Dictionary<string, object> { ["in_ContinueOnError"] = false, ["in_Pattern"] = "\\d+", ["in_RuleName"] = "numbers", ["in_UsePlaceholder"] = true });
            rule = (UiPath.Testing.Activities.Models.ComparisonRule)__xaml1["out_ComparisonRule"];
            // 規則つきで比べる
            // CompareText は対応表が無いので XAML 経由（coded/_activities/CompareText_145dde.xaml）
            var __xaml2 = RunWorkflow("coded/_activities/CompareText_145dde.xaml", new Dictionary<string, object> { ["in_BaselineText"] = "Order 123 done", ["in_ContinueOnFailure"] = true, ["in_OutputFilePath"] = outPath, ["in_RulesList"] = new List<UiPath.Testing.Activities.Models.ComparisonRule> { rule }, ["in_TargetText"] = "Order 456 done", ["in_WordSeparators"] = " " });
            withRule = (System.Boolean)__xaml2["out_Result"];
            // 規則なしで比べる
            // CompareText は対応表が無いので XAML 経由（coded/_activities/CompareText_761bbc.xaml）
            var __xaml3 = RunWorkflow("coded/_activities/CompareText_761bbc.xaml", new Dictionary<string, object> { ["in_BaselineText"] = "Order 123 done", ["in_ContinueOnFailure"] = true, ["in_OutputFilePath"] = outPath, ["in_TargetText"] = "Order 456 done" });
            diffs = (System.Collections.Generic.IEnumerable<UiPath.Testing.Activities.Models.Difference>)__xaml3["out_Differences"];
            plain = (System.Boolean)__xaml3["out_Result"];
            Log(message: Convert.ToString("withRule=" + withRule.ToString() + " plain=" + plain.ToString() + " diffs=" + diffs.Count().ToString()), level: UiPath.CodedWorkflows.LogLevel.Info);
        }
    }
}
