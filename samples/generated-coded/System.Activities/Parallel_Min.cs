using System;
using System.Collections.Generic;
using System.Data;
using System.IO;
using System.Linq;
using UiPath.CodedWorkflows;
using UiPath.Platform.ResourceHandling;

namespace CatalogProbeNet8
{
    // tools/ir/gen-coded.ts で IR（Parallel_Min）から生成。手で直さず IR を直す
    public class Parallel_Min : CodedWorkflow
    {
        [Workflow]
        public void Execute()
        {
            {
                Log(message: "branch1", level: UiPath.CodedWorkflows.LogLevel.Info);
            }
            {
                Log(message: "branch2", level: UiPath.CodedWorkflows.LogLevel.Info);
            }
            {
                Log(message: "branch3", level: UiPath.CodedWorkflows.LogLevel.Info);
            }
        }
    }
}
