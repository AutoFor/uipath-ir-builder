using System;
using System.Collections.Generic;
using System.Data;
using System.IO;
using System.Linq;
using UiPath.CodedWorkflows;
using UiPath.Platform.ResourceHandling;

namespace CatalogProbeNet8
{
    // tools/ir/gen-coded.ts で IR（Continue_Min）から生成。手で直さず IR を直す
    public class Continue_Min : CodedWorkflow
    {
        [Workflow]
        public void Execute()
        {
            List<String> items = new List<String>() { "a", "b", "c" };
            foreach (String it in items)
            {
                if (it == "b")
                {
                    continue;
                }
                Log(message: "要素: " + it, level: UiPath.CodedWorkflows.LogLevel.Info);
            }
            Log(message: "ループの後", level: UiPath.CodedWorkflows.LogLevel.Info);
        }
    }
}
