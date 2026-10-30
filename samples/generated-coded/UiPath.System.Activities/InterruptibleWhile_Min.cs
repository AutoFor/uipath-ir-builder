using System;
using System.Collections.Generic;
using System.Data;
using System.IO;
using System.Linq;
using UiPath.CodedWorkflows;
using UiPath.Platform.ResourceHandling;

namespace CatalogProbeNet8
{
    // tools/ir/gen-coded.ts で IR（InterruptibleWhile_Min）から生成。手で直さず IR を直す
    public class InterruptibleWhile_Min : CodedWorkflow
    {
        [Workflow]
        public void Execute()
        {
            Int32 i = default;
            var __loop1 = -1;
            while (i < 3)
            {
                __loop1++;
                i = i + 1;
                Log(message: "i=" + i.ToString(), level: UiPath.CodedWorkflows.LogLevel.Info);
            }
        }
    }
}
