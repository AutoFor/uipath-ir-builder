using System;
using System.Collections.Generic;
using System.Data;
using System.IO;
using System.Linq;
using UiPath.CodedWorkflows;
using UiPath.Platform.ResourceHandling;

namespace CatalogProbeNet8
{
    // tools/ir/gen-coded.ts で IR（Parallel_Full）から生成。手で直さず IR を直す
    public class Parallel_Full : CodedWorkflow
    {
        [Workflow]
        public void Execute()
        {
            Int32 done = 0;
            // 2つ終わったら止める
            {
                String tag = "p";
                {
                    Log(message: tag + "1", level: UiPath.CodedWorkflows.LogLevel.Info);
                    done = done + 1;
                }
                if (!(done >= 2))
                {
                    {
                        Log(message: tag + "2", level: UiPath.CodedWorkflows.LogLevel.Info);
                        done = done + 1;
                    }
                    if (!(done >= 2))
                    {
                        {
                            Log(message: tag + "3", level: UiPath.CodedWorkflows.LogLevel.Info);
                            done = done + 1;
                        }
                    }
                }
            }
            Log(message: "done=" + done.ToString(), level: UiPath.CodedWorkflows.LogLevel.Info);
        }
    }
}
