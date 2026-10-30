using System;
using System.Collections.Generic;
using System.Data;
using System.IO;
using System.Linq;
using UiPath.CodedWorkflows;
using UiPath.Platform.ResourceHandling;
using System.Security;

namespace CatalogProbeNet8
{
    // tools/ir/gen-coded.ts で IR（GetRobotCredential_Min）から生成。手で直さず IR を直す
    public class GetRobotCredential_Min : CodedWorkflow
    {
        [Workflow]
        public void Execute()
        {
            String user = default;
            SecureString pass = default;
            (user, pass) = system.GetCredential(assetName: "IRCredential");
            Log(message: "ユーザー: " + user, level: UiPath.CodedWorkflows.LogLevel.Info);
        }
    }
}
