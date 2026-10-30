using System;
using System.Collections.Generic;
using System.Data;
using System.IO;
using System.Linq;
using UiPath.CodedWorkflows;
using UiPath.Platform.ResourceHandling;

namespace CatalogProbeNet8
{
    // tools/ir/gen-coded.ts で IR（ExistsInCollection_Min）から生成。手で直さず IR を直す
    public class ExistsInCollection_Min : CodedWorkflow
    {
        [Workflow]
        public void Execute()
        {
            List<String> items = new List<String>() { "a", "b" };
            Boolean found = default;
            found = items.Contains("b");
            Log(message: "found=" + found.ToString(), level: UiPath.CodedWorkflows.LogLevel.Info);
        }
    }
}
