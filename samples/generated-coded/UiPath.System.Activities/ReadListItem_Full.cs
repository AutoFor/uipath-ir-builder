using System;
using System.Collections.Generic;
using System.Data;
using System.IO;
using System.Linq;
using UiPath.CodedWorkflows;
using UiPath.Platform.ResourceHandling;

namespace CatalogProbeNet8
{
    // tools/ir/gen-coded.ts で IR（ReadListItem_Full）から生成。手で直さず IR を直す
    public class ReadListItem_Full : CodedWorkflow
    {
        [Workflow]
        public void Execute()
        {
            List<String> names = new List<String>() { "a", "b", "c" };
            String got = default;
            Int32 at = 2;
            // 位置で読む
            got = names[at];
            Log(message: "got=" + got, level: UiPath.CodedWorkflows.LogLevel.Info);
            Log(message: Convert.ToString(String.Join(",", names)), level: UiPath.CodedWorkflows.LogLevel.Info);
        }
    }
}
