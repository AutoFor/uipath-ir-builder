using System;
using System.Collections.Generic;
using System.Data;
using System.IO;
using System.Linq;
using UiPath.CodedWorkflows;
using UiPath.Platform.ResourceHandling;

namespace CatalogProbeNet8
{
    // tools/ir/gen-coded.ts で IR（InvokeWorkflowFile_Timeout）から生成。手で直さず IR を直す
    public class InvokeWorkflowFile_Timeout : CodedWorkflow
    {
        [Workflow]
        public void Execute()
        {
            String msg = default;
            // 30秒の上限つき
            var __result1 = RunWorkflow("coded/InvokeWorkflowFile_Callee.cs", new Dictionary<string, object> { ["in_Name"] = "花子", ["in_Count"] = 3 }, timeout: TimeSpan.FromSeconds(30));
            msg = (String)__result1["Output"];
            Log(message: "戻り値: " + msg, level: UiPath.CodedWorkflows.LogLevel.Info);
        }
    }
}
