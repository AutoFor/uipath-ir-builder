using System;
using System.Collections.Generic;
using System.Data;
using System.IO;
using System.Linq;
using UiPath.CodedWorkflows;
using UiPath.Platform.ResourceHandling;

namespace CatalogProbeNet8
{
    // tools/ir/gen-coded.ts で IR（Placeholder_Min）から生成。手で直さず IR を直す
    public class Placeholder_Min : CodedWorkflow
    {
        [Workflow]
        public void Execute()
        {
            // Placeholder
            Log(message: "プレースホルダーの後", level: UiPath.CodedWorkflows.LogLevel.Info);
        }
    }
}
