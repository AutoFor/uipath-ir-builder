using System;
using System.Collections.Generic;
using System.Data;
using System.IO;
using System.Linq;
using UiPath.CodedWorkflows;
using UiPath.Platform.ResourceHandling;

namespace CatalogProbeNet8
{
    // tools/ir/gen-coded.ts で IR（Return_Min）から生成。手で直さず IR を直す
    public class Return_Min : CodedWorkflow
    {
        [Workflow]
        public void Execute()
        {
            Log(message: "return の前", level: UiPath.CodedWorkflows.LogLevel.Info);
            return;
            Log(message: "return の後（出ない）", level: UiPath.CodedWorkflows.LogLevel.Info);
        }
    }
}
