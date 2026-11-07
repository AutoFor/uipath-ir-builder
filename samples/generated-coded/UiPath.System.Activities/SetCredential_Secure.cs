using System;
using System.Collections.Generic;
using System.Data;
using System.IO;
using System.Linq;
using UiPath.CodedWorkflows;
using UiPath.Platform.ResourceHandling;
using System.Net;
using System.Security;

namespace CatalogProbeNet8
{
    // tools/ir/gen-coded.ts で IR（SetCredential_Secure）から生成。手で直さず IR を直す
    public class SetCredential_Secure : CodedWorkflow
    {
        [Workflow]
        public void Execute()
        {
            System.Security.SecureString spw = new System.Net.NetworkCredential("", "pw").SecurePassword;
            system.SetCredential(userName: "user1", password: new NetworkCredential(string.Empty, spw).Password, credentialName: "IRCredential", folderPath: "Shared", timeoutMS: 30000);
            Log(message: "資格情報を設定した", level: UiPath.CodedWorkflows.LogLevel.Info);
        }
    }
}
