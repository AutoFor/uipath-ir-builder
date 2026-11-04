using System;
using System.Collections.Generic;
using System.Data;
using System.IO;
using System.Linq;
using UiPath.CodedWorkflows;
using UiPath.Platform.ResourceHandling;

namespace CatalogProbeNet8
{
    // tools/ir/gen-coded.ts で IR（VerifyExpressionWithOperator_Full）から生成。手で直さず IR を直す
    public class VerifyExpressionWithOperator_Full : CodedWorkflow
    {
        [Workflow]
        public void Execute()
        {
            Boolean r1 = default;
            Boolean r2 = default;
            Boolean r3 = default;
            // 含むか
            r1 = testing.VerifyExpressionWithOperator("hello world", UiPath.Testing.Comparison.Contains, "world", null, true, "world を含む", false, false);
            // より大きいか
            r2 = testing.VerifyExpressionWithOperator(5, UiPath.Testing.Comparison.GreaterThan, 3, null, true, null, false, false);
            // 成り立たない（続ける）
            r3 = testing.VerifyExpressionWithOperator(1, UiPath.Testing.Comparison.GreaterThanOrEqual, 2, null, true, null, false, false);
            Log(message: Convert.ToString("r1=" + r1 + " r2=" + r2 + " r3=" + r3), level: UiPath.CodedWorkflows.LogLevel.Info);
        }
    }
}
