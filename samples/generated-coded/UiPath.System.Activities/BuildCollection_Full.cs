using System;
using System.Collections.Generic;
using System.Data;
using System.IO;
using System.Linq;
using UiPath.CodedWorkflows;
using UiPath.Platform.ResourceHandling;

namespace CatalogProbeNet8
{
    // tools/ir/gen-coded.ts で IR（BuildCollection_Full）から生成。手で直さず IR を直す
    public class BuildCollection_Full : CodedWorkflow
    {
        [Workflow]
        public void Execute()
        {
            List<String> built = default;
            String two = "two";
            // 3つで作る
            built = new List<String> { "one" }; built.AddRange(new String[] { two, "three" });
            Log(message: Convert.ToString(String.Join(",", built)), level: UiPath.CodedWorkflows.LogLevel.Info);
        }
    }
}
