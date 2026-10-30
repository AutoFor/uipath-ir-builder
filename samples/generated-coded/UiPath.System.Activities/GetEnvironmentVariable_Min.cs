using System;
using System.Collections.Generic;
using System.Data;
using System.IO;
using System.Linq;
using UiPath.CodedWorkflows;
using UiPath.Platform.ResourceHandling;

namespace CatalogProbeNet8
{
    // tools/ir/gen-coded.ts で IR（GetEnvironmentVariable_Min）から生成。手で直さず IR を直す
    public class GetEnvironmentVariable_Min : CodedWorkflow
    {
        [Workflow]
        public void Execute()
        {
            String val = default;
            val = System.Environment.GetEnvironmentVariable("OS");
            Log(message: "OS=" + val, level: UiPath.CodedWorkflows.LogLevel.Info);
        }
    }
}
