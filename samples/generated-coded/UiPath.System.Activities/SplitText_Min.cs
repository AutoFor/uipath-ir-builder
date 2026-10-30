using System;
using System.Collections.Generic;
using System.Data;
using System.IO;
using System.Linq;
using UiPath.CodedWorkflows;
using UiPath.Platform.ResourceHandling;

namespace CatalogProbeNet8
{
    // tools/ir/gen-coded.ts で IR（SplitText_Min）から生成。手で直さず IR を直す
    public class SplitText_Min : CodedWorkflow
    {
        [Workflow]
        public void Execute()
        {
            IEnumerable<String> parts = default;
            parts = true ? system.SplitText("a,b,c", ",") : system.SplitText("a,b,c", UiPath.Activities.System.Text.SeparatorOptions.Custom);
            Log(message: Convert.ToString(string.Join("|", parts)), level: UiPath.CodedWorkflows.LogLevel.Info);
        }
    }
}
