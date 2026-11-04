using System;
using System.Collections.Generic;
using System.Data;
using System.IO;
using System.Linq;
using UiPath.CodedWorkflows;
using UiPath.Platform.ResourceHandling;

namespace CatalogProbeNet8
{
    // tools/ir/gen-coded.ts で IR（VerifyExpressionWithOperator_Min）から生成。手で直さず IR を直す
    public class VerifyExpressionWithOperator_Min : CodedWorkflow
    {
        [Workflow]
        public void Execute()
        {
            // 2 つの値が等しいか
            _ = testing.VerifyExpressionWithOperator(10 * 2, UiPath.Testing.Comparison.Equality, 20, null, true, null, false, false);
            Log(message: "after verify", level: UiPath.CodedWorkflows.LogLevel.Info);
        }
    }
}
