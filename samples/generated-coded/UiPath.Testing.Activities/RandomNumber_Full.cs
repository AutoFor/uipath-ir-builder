using System;
using System.Collections.Generic;
using System.Data;
using System.IO;
using System.Linq;
using UiPath.CodedWorkflows;
using UiPath.Platform.ResourceHandling;

namespace CatalogProbeNet8
{
    // tools/ir/gen-coded.ts で IR（RandomNumber_Full）から生成。手で直さず IR を直す
    public class RandomNumber_Full : CodedWorkflow
    {
        [Workflow]
        public void Execute()
        {
            Decimal n = default;
            // 1〜5、小数 2 桁
            n = testing.RandomNumber(min: 1, max: 5, decimals: 2);
            Log(message: Convert.ToString("inRange=" + (n >= 1 && n <= 5)), level: UiPath.CodedWorkflows.LogLevel.Info);
            Log(message: Convert.ToString("decimals<=2=" + (decimal.Round(n, 2) == n)), level: UiPath.CodedWorkflows.LogLevel.Info);
        }
    }
}
