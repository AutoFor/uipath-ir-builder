using System;
using System.Collections.Generic;
using System.Data;
using System.IO;
using System.Linq;
using UiPath.CodedWorkflows;
using UiPath.Platform.ResourceHandling;

namespace CatalogProbeNet8
{
    // tools/ir/gen-coded.ts で IR（RetryScope_Full）から生成。手で直さず IR を直す
    public class RetryScope_Full : CodedWorkflow
    {
        [Workflow]
        public void Execute()
        {
            Int32 count = default;
            // 2回目で成功
            for (var __retry1 = 1; ; __retry1++)
            {
                try
                {
                    count = count + 1;
                    Log(message: "試行 " + count.ToString(), level: UiPath.CodedWorkflows.LogLevel.Info);
                    if (count < 2)
                    {
                        throw new InvalidOperationException("まだだめ");
                    }
                    break;
                }
                catch (Exception) when (__retry1 < 3)
                {
                    Delay(TimeSpan.FromMilliseconds(100));
                }
            }
            Log(message: "成功 count=" + count.ToString(), level: UiPath.CodedWorkflows.LogLevel.Info);
        }
    }
}
