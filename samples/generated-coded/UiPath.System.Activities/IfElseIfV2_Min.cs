using System;
using System.Collections.Generic;
using System.Data;
using System.IO;
using System.Linq;
using UiPath.CodedWorkflows;
using UiPath.Platform.ResourceHandling;

namespace CatalogProbeNet8
{
    // tools/ir/gen-coded.ts で IR（IfElseIfV2_Min）から生成。手で直さず IR を直す
    public class IfElseIfV2_Min : CodedWorkflow
    {
        [Workflow]
        public void Execute()
        {
            String label = "none";
            Int32 count = 2;
            // 大きさで分ける
            // IfElseIfV2 は対応表が無いので XAML 経由（coded/_xaml/IfElseIfV2_Min_1.xaml）
            var __xaml1 = RunWorkflow("coded/_xaml/IfElseIfV2_Min_1.xaml", new Dictionary<string, object> { ["count"] = count, ["label"] = label });
            label = (String)__xaml1["label"];
            Log(message: "結果: " + label, level: UiPath.CodedWorkflows.LogLevel.Info);
        }
    }
}
