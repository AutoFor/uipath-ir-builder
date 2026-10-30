using System;
using System.Collections.Generic;
using System.Data;
using System.IO;
using System.Linq;
using UiPath.CodedWorkflows;
using UiPath.Platform.ResourceHandling;

namespace CatalogProbeNet8
{
    // tools/ir/gen-coded.ts で IR（AppendItemToCollection_Full）から生成。手で直さず IR を直す
    public class AppendItemToCollection_Full : CodedWorkflow
    {
        [Workflow]
        public void Execute()
        {
            List<String> items = new List<String>() { "x" };
            String suffix = "!";
            List<String> updated = default;
            // 3つ足す（元を変える）
            foreach (var __append in new String[] { "a", "b" + suffix, suffix + suffix }) items.Add(__append);
            Log(message: Convert.ToString(String.Join(",", items)), level: UiPath.CodedWorkflows.LogLevel.Info);
            // Result に新しいリストを受ける
            updated = new List<String>(items); updated.AddRange(new String[] { "z" });
            Log(message: Convert.ToString(String.Join(",", items)), level: UiPath.CodedWorkflows.LogLevel.Info);
            Log(message: Convert.ToString(String.Join(",", updated)), level: UiPath.CodedWorkflows.LogLevel.Info);
        }
    }
}
