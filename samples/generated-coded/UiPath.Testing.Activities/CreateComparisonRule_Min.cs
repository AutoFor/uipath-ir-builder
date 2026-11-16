using System;
using System.Collections.Generic;
using System.Data;
using System.IO;
using System.Linq;
using UiPath.CodedWorkflows;
using UiPath.Platform.ResourceHandling;

namespace CatalogProbeNet8
{
    // tools/ir/gen-coded.ts で IR（CreateComparisonRule_Min）から生成。手で直さず IR を直す
    public class CreateComparisonRule_Min : CodedWorkflow
    {
        [Workflow]
        public void Execute()
        {
            UiPath.Testing.Activities.Models.ComparisonRule rule = default;
            Boolean same = default;
            String outPath = System.IO.Path.Combine(System.IO.Path.GetTempPath(), "uta-compare-rule.html");
            // ワイルドカードの規則
            // CreateComparisonRule は対応表が無いので XAML 経由（coded/_activities/CreateComparisonRule_90a78d.xaml）
            var __xaml1 = RunWorkflow("coded/_activities/CreateComparisonRule_90a78d.xaml", new Dictionary<string, object> { ["in_Pattern"] = "file_*", ["in_RuleName"] = "files" });
            rule = (UiPath.Testing.Activities.Models.ComparisonRule)__xaml1["out_ComparisonRule"];
            // 規則つきで比べる
            // CompareText は対応表が無いので XAML 経由（coded/_activities/CompareText_783ae1.xaml）
            var __xaml2 = RunWorkflow("coded/_activities/CompareText_783ae1.xaml", new Dictionary<string, object> { ["in_BaselineText"] = "see file_01", ["in_ContinueOnFailure"] = true, ["in_OutputFilePath"] = outPath, ["in_RulesList"] = new List<UiPath.Testing.Activities.Models.ComparisonRule> { rule }, ["in_TargetText"] = "see file_99" });
            same = (System.Boolean)__xaml2["out_Result"];
            Log(message: Convert.ToString("same=" + same.ToString()), level: UiPath.CodedWorkflows.LogLevel.Info);
        }
    }
}
