using System;
using System.Collections.Generic;
using System.Data;
using System.IO;
using System.Linq;
using UiPath.CodedWorkflows;
using UiPath.Platform.ResourceHandling;

namespace CatalogProbeNet8
{
    // tools/ir/gen-coded.ts で IR（LastName_Min）から生成。手で直さず IR を直す
    public class LastName_Min : CodedWorkflow
    {
        [Workflow]
        public void Execute()
        {
            String name = default;
            // 名字
            name = testing.LastName();
            Log(message: Convert.ToString("hasName=" + !string.IsNullOrEmpty(name)), level: UiPath.CodedWorkflows.LogLevel.Info);
        }
    }
}
