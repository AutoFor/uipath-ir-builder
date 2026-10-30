using System;
using System.Collections.Generic;
using System.Data;
using System.IO;
using System.Linq;
using UiPath.CodedWorkflows;
using UiPath.Platform.ResourceHandling;

namespace CatalogProbeNet8
{
    // tools/ir/gen-coded.ts で IR（MergeCollections_Min）から生成。手で直さず IR を直す
    public class MergeCollections_Min : CodedWorkflow
    {
        [Workflow]
        public void Execute()
        {
            List<String> first = new List<String>() { "a" };
            List<String> second = new List<String>() { "b", "c" };
            List<String> merged = default;
            merged = first.Concat(second).ToList();
            Log(message: Convert.ToString(String.Join(",", merged)), level: UiPath.CodedWorkflows.LogLevel.Info);
        }
    }
}
