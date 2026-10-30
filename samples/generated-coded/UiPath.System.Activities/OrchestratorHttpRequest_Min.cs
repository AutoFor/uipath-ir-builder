using System;
using System.Collections.Generic;
using System.Data;
using System.IO;
using System.Linq;
using UiPath.CodedWorkflows;
using UiPath.Platform.ResourceHandling;

namespace CatalogProbeNet8
{
    // tools/ir/gen-coded.ts で IR（OrchestratorHttpRequest_Min）から生成。手で直さず IR を直す
    public class OrchestratorHttpRequest_Min : CodedWorkflow
    {
        [Workflow]
        public void Execute()
        {
            Int32 status = default;
            status = system.OrchestratorHTTPRequest(method: UiPath.Core.Activities.OrchestratorAPIHttpMethods.GET, relativeEndpoint: "/odata/Folders?$top=1", jSONPayload: null, responseHeaders: out _, result: out _, folderPath: null);
            Log(message: "ステータス: " + status.ToString(), level: UiPath.CodedWorkflows.LogLevel.Info);
        }
    }
}
