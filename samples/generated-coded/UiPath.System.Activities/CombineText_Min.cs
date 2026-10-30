using System;
using System.Collections.Generic;
using System.Data;
using System.IO;
using System.Linq;
using UiPath.CodedWorkflows;
using UiPath.Platform.ResourceHandling;

namespace CatalogProbeNet8
{
    // tools/ir/gen-coded.ts で IR（CombineText_Min）から生成。手で直さず IR を直す
    public class CombineText_Min : CodedWorkflow
    {
        [Workflow]
        public void Execute()
        {
            List<String> parts = default;
            String r = default;
            parts = new List<string> { "a", "b", "c" };
            r = true ? system.CombineText(parts, "-") : system.CombineText(parts, UiPath.Activities.System.Text.SeparatorOptions.Custom);
            Log(message: r, level: UiPath.CodedWorkflows.LogLevel.Info);
        }
    }
}
