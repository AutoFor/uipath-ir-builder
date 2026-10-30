using System;
using System.Collections.Generic;
using System.Data;
using System.IO;
using System.Linq;
using UiPath.CodedWorkflows;
using UiPath.Platform.ResourceHandling;

namespace CatalogProbeNet8
{
    // tools/ir/gen-coded.ts で IR（MergeCollections_Full）から生成。手で直さず IR を直す
    public class MergeCollections_Full : CodedWorkflow
    {
        [Workflow]
        public void Execute()
        {
            List<String> first = new List<String>() { "a" };
            List<String> second = new List<String>() { "b", "c" };
            List<String> merged = default;
            // 2つをまとめる
            merged = first.Concat(second).ToList();
            Log(message: Convert.ToString(String.Join(",", merged)), level: UiPath.CodedWorkflows.LogLevel.Info);
            Log(message: Convert.ToString(String.Join(",", first)), level: UiPath.CodedWorkflows.LogLevel.Info);
            Log(message: Convert.ToString(String.Join(",", second)), level: UiPath.CodedWorkflows.LogLevel.Info);
        }
    }
}
