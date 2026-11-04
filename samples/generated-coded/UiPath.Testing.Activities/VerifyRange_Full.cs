using System;
using System.Collections.Generic;
using System.Data;
using System.IO;
using System.Linq;
using UiPath.CodedWorkflows;
using UiPath.Platform.ResourceHandling;

namespace CatalogProbeNet8
{
    // tools/ir/gen-coded.ts で IR（VerifyRange_Full）から生成。手で直さず IR を直す
    public class VerifyRange_Full : CodedWorkflow
    {
        [Workflow]
        public void Execute()
        {
            Boolean inside = default;
            Boolean outside = default;
            // 範囲外か
            outside = testing.VerifyRange(15, UiPath.Testing.Activities.VerificationType.IsNotWithin, 1, 10, null, true, "15 は 1〜10 の外", false, false);
            // 範囲内でない（続ける）
            inside = testing.VerifyRange(0.5, UiPath.Testing.Activities.VerificationType.IsWithin, 1.0, 10.0, null, true, null, false, false);
            Log(message: Convert.ToString("outside=" + outside + " inside=" + inside), level: UiPath.CodedWorkflows.LogLevel.Info);
        }
    }
}
