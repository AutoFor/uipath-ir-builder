using System;
using System.Collections.Generic;
using System.Data;
using System.IO;
using System.Linq;
using UiPath.CodedWorkflows;
using UiPath.Platform.ResourceHandling;

namespace CatalogProbeNet8
{
    // tools/ir/gen-coded.ts で IR（VerifyExpression_Min）から生成。手で直さず IR を直す
    public class VerifyExpression_Min : CodedWorkflow
    {
        [Workflow]
        public void Execute()
        {
            // 1 + 1 が 2 か確かめる
            _ = testing.VerifyExpression(1 + 1 == 2, null, true, null, false, false);
            Log(message: "after verify", level: UiPath.CodedWorkflows.LogLevel.Info);
        }
    }
}
