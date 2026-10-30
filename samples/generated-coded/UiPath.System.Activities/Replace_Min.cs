using System;
using System.Collections.Generic;
using System.Data;
using System.IO;
using System.Linq;
using UiPath.CodedWorkflows;
using UiPath.Platform.ResourceHandling;

namespace CatalogProbeNet8
{
    // tools/ir/gen-coded.ts で IR（Replace_Min）から生成。手で直さず IR を直す
    public class Replace_Min : CodedWorkflow
    {
        [Workflow]
        public void Execute()
        {
            String r = default;
            r = system.Replace(input: "a1b22c333", pattern: "\\d+", replacement: "#");
            Log(message: r, level: UiPath.CodedWorkflows.LogLevel.Info);
        }
    }
}
