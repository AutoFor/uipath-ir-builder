using System;
using System.Collections.Generic;
using System.Data;
using System.IO;
using System.Linq;
using UiPath.CodedWorkflows;
using UiPath.Platform.ResourceHandling;

namespace CatalogProbeNet8
{
    // tools/ir/gen-coded.ts で IR（RemoveFromCollection_Min）から生成。手で直さず IR を直す
    public class RemoveFromCollection_Min : CodedWorkflow
    {
        [Workflow]
        public void Execute()
        {
            List<String> items = new List<String>() { "a", "b", "c" };
            items.Remove("b");
            Log(message: Convert.ToString(String.Join(",", items)), level: UiPath.CodedWorkflows.LogLevel.Info);
        }
    }
}
