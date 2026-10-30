using System;
using System.Collections.Generic;
using System.Data;
using System.IO;
using System.Linq;
using UiPath.CodedWorkflows;
using UiPath.Platform.ResourceHandling;

namespace CatalogProbeNet8
{
    // tools/ir/gen-coded.ts で IR（InterruptibleWhile_Full）から生成。手で直さず IR を直す
    public class InterruptibleWhile_Full : CodedWorkflow
    {
        [Workflow]
        public void Execute()
        {
            Int32 idx = default;
            Int32 n = default;
            // 最大2回
            idx = -1;
            while (true && idx + 1 < 2)
            {
                idx++;
                n = n + 1;
                Log(message: "idx=" + idx.ToString() + ", n=" + n.ToString(), level: UiPath.CodedWorkflows.LogLevel.Info);
            }
            Log(message: "終了 n=" + n.ToString(), level: UiPath.CodedWorkflows.LogLevel.Info);
        }
    }
}
