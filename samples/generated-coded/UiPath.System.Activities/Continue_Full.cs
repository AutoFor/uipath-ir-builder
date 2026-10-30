using System;
using System.Collections.Generic;
using System.Data;
using System.IO;
using System.Linq;
using UiPath.CodedWorkflows;
using UiPath.Platform.ResourceHandling;

namespace CatalogProbeNet8
{
    // tools/ir/gen-coded.ts で IR（Continue_Full）から生成。手で直さず IR を直す
    public class Continue_Full : CodedWorkflow
    {
        [Workflow]
        public void Execute()
        {
            Int32 i = default;
            var __loop1 = -1;
            while (i < 4)
            {
                __loop1++;
                i = i + 1;
                if (i % 2 == 0)
                {
                    // 偶数は飛ばす
                    continue;
                }
                Log(message: "奇数: " + i.ToString(), level: UiPath.CodedWorkflows.LogLevel.Info);
            }
            Log(message: "ループの後", level: UiPath.CodedWorkflows.LogLevel.Info);
        }
    }
}
