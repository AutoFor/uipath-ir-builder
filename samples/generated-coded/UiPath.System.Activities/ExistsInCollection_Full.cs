using System;
using System.Collections.Generic;
using System.Data;
using System.IO;
using System.Linq;
using UiPath.CodedWorkflows;
using UiPath.Platform.ResourceHandling;

namespace CatalogProbeNet8
{
    // tools/ir/gen-coded.ts で IR（ExistsInCollection_Full）から生成。手で直さず IR を直す
    public class ExistsInCollection_Full : CodedWorkflow
    {
        [Workflow]
        public void Execute()
        {
            List<String> items = new List<String>() { "a", "b" };
            Boolean found = default;
            Int32 pos = default;
            Boolean found2 = default;
            Int32 pos2 = default;
            // b を探す
            pos = items.ToList().IndexOf("b"); found = pos >= 0;
            Log(message: "found=" + found.ToString() + ", index=" + pos.ToString(), level: UiPath.CodedWorkflows.LogLevel.Info);
            // z を探す
            pos2 = items.ToList().IndexOf("z"); found2 = pos2 >= 0;
            Log(message: "found=" + found2.ToString(), level: UiPath.CodedWorkflows.LogLevel.Info);
        }
    }
}
