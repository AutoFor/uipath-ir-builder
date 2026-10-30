using System;
using System.Collections.Generic;
using System.Data;
using System.IO;
using System.Linq;
using UiPath.CodedWorkflows;
using UiPath.Platform.ResourceHandling;

namespace CatalogProbeNet8
{
    // tools/ir/gen-coded.ts で IR（AppendItemToList_Full）から生成。手で直さず IR を直す
    public class AppendItemToList_Full : CodedWorkflow
    {
        [Workflow]
        public void Execute()
        {
            List<String> names = new List<String>() { "a" };
            Int32 idx = default;
            // 末尾に足す
            names.Add("b"); idx = names.Count - 1;
            Log(message: "index=" + idx.ToString(), level: UiPath.CodedWorkflows.LogLevel.Info);
            Log(message: Convert.ToString(String.Join(",", names)), level: UiPath.CodedWorkflows.LogLevel.Info);
        }
    }
}
