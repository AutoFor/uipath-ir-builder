using System;
using System.Collections.Generic;
using System.Data;
using System.IO;
using System.Linq;
using UiPath.CodedWorkflows;
using UiPath.Platform.ResourceHandling;

namespace CatalogProbeNet8
{
    // tools/ir/gen-coded.ts で IR（AppendItemToList_Min）から生成。手で直さず IR を直す
    public class AppendItemToList_Min : CodedWorkflow
    {
        [Workflow]
        public void Execute()
        {
            List<String> names = new List<String>() { "a" };
            names.Add("b");
            Log(message: Convert.ToString(String.Join(",", names)), level: UiPath.CodedWorkflows.LogLevel.Info);
        }
    }
}
