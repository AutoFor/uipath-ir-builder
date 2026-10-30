using System;
using System.Collections.Generic;
using System.Data;
using System.IO;
using System.Linq;
using UiPath.CodedWorkflows;
using UiPath.Platform.ResourceHandling;

namespace CatalogProbeNet8
{
    // tools/ir/gen-coded.ts で IR（UpdateListItem_Min）から生成。手で直さず IR を直す
    public class UpdateListItem_Min : CodedWorkflow
    {
        [Workflow]
        public void Execute()
        {
            List<String> names = new List<String>() { "a", "b", "c" };
            names[1] = "B";
            Log(message: Convert.ToString(String.Join(",", names)), level: UiPath.CodedWorkflows.LogLevel.Info);
        }
    }
}
