using System;
using System.Collections.Generic;
using System.Data;
using System.IO;
using System.Linq;
using UiPath.CodedWorkflows;
using UiPath.Platform.ResourceHandling;

namespace CatalogProbeNet8
{
    // tools/ir/gen-coded.ts で IR（ParallelForEach_Full）から生成。手で直さず IR を直す
    public class ParallelForEach_Full : CodedWorkflow
    {
        [Workflow]
        public void Execute()
        {
            List<String> names = new List<String>() { "a", "b", "c" };
            Int32 done = 0;
            // 2つ終わったら止める
            foreach (String it in names)
            {
                Log(message: "item=" + it, level: UiPath.CodedWorkflows.LogLevel.Info);
                done = done + 1;
                if (done >= 2) break;
            }
            Log(message: "done=" + done.ToString(), level: UiPath.CodedWorkflows.LogLevel.Info);
        }
    }
}
