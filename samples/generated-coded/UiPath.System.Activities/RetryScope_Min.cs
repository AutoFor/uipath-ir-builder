using System;
using System.Collections.Generic;
using System.Data;
using System.IO;
using System.Linq;
using UiPath.CodedWorkflows;
using UiPath.Platform.ResourceHandling;

namespace CatalogProbeNet8
{
    // tools/ir/gen-coded.ts で IR（RetryScope_Min）から生成。手で直さず IR を直す
    public class RetryScope_Min : CodedWorkflow
    {
        [Workflow]
        public void Execute()
        {
            for (var __retry1 = 1; ; __retry1++)
            {
                try
                {
                    Log(message: "リトライの中", level: UiPath.CodedWorkflows.LogLevel.Info);
                    break;
                }
                catch (Exception) when (__retry1 < 3)
                {
                    Delay(TimeSpan.FromSeconds(5));
                }
            }
            Log(message: "リトライの後", level: UiPath.CodedWorkflows.LogLevel.Info);
        }
    }
}
