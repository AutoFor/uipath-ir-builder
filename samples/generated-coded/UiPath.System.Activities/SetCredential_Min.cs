using System;
using System.Collections.Generic;
using System.Data;
using System.IO;
using System.Linq;
using UiPath.CodedWorkflows;
using UiPath.Platform.ResourceHandling;

namespace CatalogProbeNet8
{
    // tools/ir/gen-coded.ts で IR（SetCredential_Min）から生成。手で直さず IR を直す
    public class SetCredential_Min : CodedWorkflow
    {
        [Workflow]
        public void Execute()
        {
            system.SetCredential(userName: "user1", password: "pw", credentialName: "IRCredential");
            Log(message: "資格情報を設定した", level: UiPath.CodedWorkflows.LogLevel.Info);
        }
    }
}
