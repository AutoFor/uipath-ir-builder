using System;
using System.Collections.Generic;
using System.Data;
using System.IO;
using System.Linq;
using UiPath.CodedWorkflows;
using UiPath.Platform.ResourceHandling;

namespace CatalogProbeNet8
{
    // tools/ir/gen-coded.ts で IR（ChangeType_Min）から生成。手で直さず IR を直す
    public class ChangeType_Min : CodedWorkflow
    {
        [Workflow]
        public void Execute()
        {
            String src = "42";
            Int32 num = default;
            num = (Int32)Convert.ChangeType(src, typeof(Int32));
            Log(message: (num + 1).ToString(), level: UiPath.CodedWorkflows.LogLevel.Info);
        }
    }
}
