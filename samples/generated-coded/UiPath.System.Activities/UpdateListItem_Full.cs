using System;
using System.Collections.Generic;
using System.Data;
using System.IO;
using System.Linq;
using UiPath.CodedWorkflows;
using UiPath.Platform.ResourceHandling;

namespace CatalogProbeNet8
{
    // tools/ir/gen-coded.ts で IR（UpdateListItem_Full）から生成。手で直さず IR を直す
    public class UpdateListItem_Full : CodedWorkflow
    {
        [Workflow]
        public void Execute()
        {
            List<String> names = new List<String>() { "a", "b", "c" };
            Int32 at = 0;
            String newValue = "A" + "!";
            // 位置で更新
            names[at] = newValue;
            Log(message: Convert.ToString(String.Join(",", names)), level: UiPath.CodedWorkflows.LogLevel.Info);
        }
    }
}
