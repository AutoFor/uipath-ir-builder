using System;
using System.Collections.Generic;
using System.Data;
using System.IO;
using System.Linq;
using UiPath.CodedWorkflows;
using UiPath.Platform.ResourceHandling;

namespace CatalogProbeNet8
{
    // tools/ir/gen-coded.ts で IR（VerifyRange_Min）から生成。手で直さず IR を直す
    public class VerifyRange_Min : CodedWorkflow
    {
        [Workflow]
        public void Execute()
        {
            // 範囲内か
            _ = testing.VerifyRange(5, UiPath.Testing.Activities.VerificationType.IsWithin, 1, 10, null, true, null, false, false);
            Log(message: "after verify", level: UiPath.CodedWorkflows.LogLevel.Info);
        }
    }
}
