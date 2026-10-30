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
    // tools/ir/gen-coded.ts で IR（GetRobotCredential_Full）から生成。手で直さず IR を直す
    public class GetRobotCredential_Full : CodedWorkflow
    {
        [Workflow]
        public void Execute()
        {
            String user = default;
            SecureString pass = default;
            // 資格情報を取得
            (user, pass) = system.GetCredential(assetName: "IRCredential", folderPath: "Shared", timeoutMS: 30000, cacheStrategy: UiPath.Core.Activities.CacheStrategyEnum.Execution);
            Log(message: "ユーザー: " + user, level: UiPath.CodedWorkflows.LogLevel.Info);
        }
    }
}
