using System;
using System.Collections.Generic;
using System.Data;
using System.IO;
using System.Linq;
using UiPath.CodedWorkflows;
using UiPath.Platform.ResourceHandling;

namespace CatalogProbeNet8
{
    // tools/ir/gen-coded.ts で IR（CompareText_Min）から生成。手で直さず IR を直す
    public class CompareText_Min : CodedWorkflow
    {
        [Workflow]
        public void Execute()
        {
            Boolean same = default;
            String outPath = System.IO.Path.Combine(System.IO.Path.GetTempPath(), "uta-compare-text.html");
            // 行ごとに比べる
            // CompareText は対応表が無いので XAML 経由（coded/_activities/CompareText_f3789c.xaml）
            var __xaml1 = RunWorkflow("coded/_activities/CompareText_f3789c.xaml", new Dictionary<string, object> { ["in_BaselineText"] = "a", ["in_OutputFilePath"] = outPath, ["in_TargetText"] = "a" });
            same = (System.Boolean)__xaml1["out_Result"];
            Log(message: Convert.ToString("same=" + same.ToString()), level: UiPath.CodedWorkflows.LogLevel.Info);
        }
    }
}
