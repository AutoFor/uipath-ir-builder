using System;
using System.Collections.Generic;
using System.Data;
using System.IO;
using System.Linq;
using UiPath.CodedWorkflows;
using UiPath.Platform.ResourceHandling;

namespace CatalogProbeNet8
{
    // tools/ir/gen-coded.ts で IR（ForEach_Full）から生成。手で直さず IR を直す
    public class ForEach_Full : CodedWorkflow
    {
        [Workflow]
        public void Execute()
        {
            List<String> names = new List<String>() { "a", "b", "c" };
            Int32 pos = default;
            // 最大2回
            var __foreach1 = 0;
            pos = -1;
            foreach (String it in names)
            {
                if (__foreach1 >= 2) break;
                __foreach1++;
                pos++;
                Log(message: pos.ToString() + ":" + it, level: UiPath.CodedWorkflows.LogLevel.Info);
            }
        }
    }
}
