using System;
using System.Collections.Generic;
using System.Data;
using System.IO;
using System.Linq;
using UiPath.CodedWorkflows;
using UiPath.Platform.ResourceHandling;

namespace CatalogProbeNet8
{
    // tools/ir/gen-coded.ts で IR（OrchestratorHttpRequest_Full）から生成。手で直さず IR を直す
    public class OrchestratorHttpRequest_Full : CodedWorkflow
    {
        [Workflow]
        public void Execute()
        {
            Int32 status = default;
            Dictionary<String, String> headers = default;
            String body = default;
            // Orchestrator に問い合わせる
            status = system.OrchestratorHTTPRequest(method: UiPath.Core.Activities.OrchestratorAPIHttpMethods.POST, relativeEndpoint: "/odata/Assets", jSONPayload: "{\"Name\":\"ir-asset\",\"ValueScope\":\"Global\",\"ValueType\":\"Text\",\"StringValue\":\"ir\"}", folderPath: "Shared", responseHeaders: out headers, result: out body, timeoutMS: 30000);
            Log(message: "ステータス: " + status.ToString(), level: UiPath.CodedWorkflows.LogLevel.Info);
            Log(message: "本文の長さ: " + body.Length.ToString(), level: UiPath.CodedWorkflows.LogLevel.Info);
        }
    }
}
