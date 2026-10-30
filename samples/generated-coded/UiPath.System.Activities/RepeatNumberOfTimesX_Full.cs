using System;
using System.Collections.Generic;
using System.Data;
using System.IO;
using System.Linq;
using UiPath.CodedWorkflows;
using UiPath.Platform.ResourceHandling;

namespace CatalogProbeNet8
{
    // tools/ir/gen-coded.ts で IR（RepeatNumberOfTimesX_Full）から生成。手で直さず IR を直す
    public class RepeatNumberOfTimesX_Full : CodedWorkflow
    {
        [Workflow]
        public void Execute()
        {
            Int32 times = 2;
            // 5から2回
            for (var __repeat1 = 0; __repeat1 < times; __repeat1++)
            {
                int n = 5 + __repeat1;
                Log(message: "n=" + n.ToString(), level: UiPath.CodedWorkflows.LogLevel.Info);
            }
        }
    }
}
