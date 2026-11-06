using System;
using System.Collections.Generic;
using System.Data;
using System.IO;
using System.Linq;
using UiPath.CodedWorkflows;
using UiPath.Platform.ResourceHandling;

namespace CatalogProbeNet8
{
    // tools/ir/gen-coded.ts で IR（SetSecret_Secure）から生成。手で直さず IR を直す
    public class SetSecret_Secure : CodedWorkflow
    {
        [Workflow]
        public void Execute()
        {
            SecureString ssec = new System.Net.NetworkCredential("", "s3").SecurePassword;
            // SetSecret はCoded API が無い（Coded API なし（ISystemService に SetSecret が無い））ので XAML 経由（coded/_activities/SetSecret_07222f.xaml）
            RunWorkflow("coded/_activities/SetSecret_07222f.xaml", new Dictionary<string, object> { ["in_AssetName"] = "IRSecret", ["in_FolderPath"] = "Shared", ["in_SecureSecretValue"] = ssec, ["in_TimeoutMS"] = 30000 });
            Log(message: "シークレットを設定した", level: UiPath.CodedWorkflows.LogLevel.Info);
        }
    }
}
