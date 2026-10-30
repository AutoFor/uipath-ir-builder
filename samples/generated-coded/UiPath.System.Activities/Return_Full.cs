using System;
using System.Collections.Generic;
using System.Data;
using System.IO;
using System.Linq;
using UiPath.CodedWorkflows;
using UiPath.Platform.ResourceHandling;

namespace CatalogProbeNet8
{
    // tools/ir/gen-coded.ts で IR（Return_Full）から生成。手で直さず IR を直す
    public class Return_Full : CodedWorkflow
    {
        [Workflow]
        public void Execute()
        {
            Int32 i = default;
            while (true)
            {
                i = i + 1;
                Log(message: "ループ " + i.ToString(), level: UiPath.CodedWorkflows.LogLevel.Info);
                if (i == 2)
                {
                    // ワークフローを抜ける
                    return;
                }
            }
            Log(message: "ここには来ない", level: UiPath.CodedWorkflows.LogLevel.Info);
        }
    }
}
