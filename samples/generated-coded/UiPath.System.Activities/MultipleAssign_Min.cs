using System;
using System.Collections.Generic;
using System.Data;
using System.IO;
using System.Linq;
using UiPath.CodedWorkflows;
using UiPath.Platform.ResourceHandling;

namespace CatalogProbeNet8
{
    // tools/ir/gen-coded.ts で IR（MultipleAssign_Min）から生成。手で直さず IR を直す
    public class MultipleAssign_Min : CodedWorkflow
    {
        [Workflow]
        public void Execute()
        {
            Int32 a = default;
            Int32 b = default;
            a = 1;
            b = 2;
            Log(message: "a=" + a.ToString() + ", b=" + b.ToString(), level: UiPath.CodedWorkflows.LogLevel.Info);
        }
    }
}
