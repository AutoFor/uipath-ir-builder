using System;
using System.Collections.Generic;
using System.Data;
using System.IO;
using System.Linq;
using UiPath.CodedWorkflows;
using UiPath.Platform.ResourceHandling;

namespace CatalogProbeNet8
{
    // tools/ir/gen-coded.ts で IR（RandomNumber_Min）から生成。手で直さず IR を直す
    public class RandomNumber_Min : CodedWorkflow
    {
        [Workflow]
        public void Execute()
        {
            Decimal n = default;
            // 乱数
            n = testing.RandomNumber();
            Log(message: Convert.ToString("type=" + n.GetType().Name), level: UiPath.CodedWorkflows.LogLevel.Info);
        }
    }
}
