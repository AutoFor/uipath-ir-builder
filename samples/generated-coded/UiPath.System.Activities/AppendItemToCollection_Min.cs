using System;
using System.Collections.Generic;
using System.Data;
using System.IO;
using System.Linq;
using UiPath.CodedWorkflows;
using UiPath.Platform.ResourceHandling;

namespace CatalogProbeNet8
{
    // tools/ir/gen-coded.ts で IR（AppendItemToCollection_Min）から生成。手で直さず IR を直す
    public class AppendItemToCollection_Min : CodedWorkflow
    {
        [Workflow]
        public void Execute()
        {
            List<String> items = new List<String>();
            foreach (var __append in new String[] { "apple" }) items.Add(__append);
            Log(message: Convert.ToString(String.Join(",", items)), level: UiPath.CodedWorkflows.LogLevel.Info);
        }
    }
}
