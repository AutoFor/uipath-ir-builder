using System;
using System.Collections.Generic;
using System.Data;
using System.IO;
using System.Linq;
using UiPath.CodedWorkflows;
using UiPath.Platform.ResourceHandling;

namespace CatalogProbeNet8
{
    // tools/ir/gen-coded.ts で IR（BuildCollection_Items）から生成。手で直さず IR を直す
    public class BuildCollection_Items : CodedWorkflow
    {
        [Workflow]
        public void Execute()
        {
            List<String> rest = new List<String>() { "b", "c" };
            List<String> built = default;
            // 既存のコレクションをつなぐ
            built = new List<String> { "a" }; built.AddRange(rest);
            Log(message: Convert.ToString(String.Join(",", built)), level: UiPath.CodedWorkflows.LogLevel.Info);
            Log(message: Convert.ToString(String.Join(",", rest)), level: UiPath.CodedWorkflows.LogLevel.Info);
        }
    }
}
