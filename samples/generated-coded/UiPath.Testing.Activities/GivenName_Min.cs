using System;
using System.Collections.Generic;
using System.Data;
using System.IO;
using System.Linq;
using UiPath.CodedWorkflows;
using UiPath.Platform.ResourceHandling;

namespace CatalogProbeNet8
{
    // tools/ir/gen-coded.ts で IR（GivenName_Min）から生成。手で直さず IR を直す
    public class GivenName_Min : CodedWorkflow
    {
        [Workflow]
        public void Execute()
        {
            String name = default;
            // 名前
            name = testing.GivenName();
            Log(message: Convert.ToString("hasName=" + !string.IsNullOrEmpty(name)), level: UiPath.CodedWorkflows.LogLevel.Info);
        }
    }
}
