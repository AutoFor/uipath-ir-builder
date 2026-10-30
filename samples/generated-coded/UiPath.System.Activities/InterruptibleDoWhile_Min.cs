using System;
using System.Collections.Generic;
using System.Data;
using System.IO;
using System.Linq;
using UiPath.CodedWorkflows;
using UiPath.Platform.ResourceHandling;

namespace CatalogProbeNet8
{
    // tools/ir/gen-coded.ts で IR（InterruptibleDoWhile_Min）から生成。手で直さず IR を直す
    public class InterruptibleDoWhile_Min : CodedWorkflow
    {
        [Workflow]
        public void Execute()
        {
            Int32 i = default;
            var __loop1 = -1;
            do
            {
                __loop1++;
                i = i + 1;
                Log(message: "i=" + i.ToString(), level: UiPath.CodedWorkflows.LogLevel.Info);
            } while (i < 0);
        }
    }
}
