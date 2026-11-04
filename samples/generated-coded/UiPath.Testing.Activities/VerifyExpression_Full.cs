using System;
using System.Collections.Generic;
using System.Data;
using System.IO;
using System.Linq;
using UiPath.CodedWorkflows;
using UiPath.Platform.ResourceHandling;

namespace CatalogProbeNet8
{
    // tools/ir/gen-coded.ts で IR（VerifyExpression_Full）から生成。手で直さず IR を直す
    public class VerifyExpression_Full : CodedWorkflow
    {
        [Workflow]
        public void Execute()
        {
            Boolean ok = default;
            Boolean ng = default;
            // 成り立つ式
            ok = testing.VerifyExpression("abc".Length == 3, "{Expression} の検証: {Result}", true, "長さは3", false, false);
            // 成り立たない式（続ける）
            ng = testing.VerifyExpression(1 > 2, null, true, "1は2より大きい", false, false);
            Log(message: Convert.ToString("ok=" + ok), level: UiPath.CodedWorkflows.LogLevel.Info);
            Log(message: Convert.ToString("ng=" + ng), level: UiPath.CodedWorkflows.LogLevel.Info);
        }
    }
}
