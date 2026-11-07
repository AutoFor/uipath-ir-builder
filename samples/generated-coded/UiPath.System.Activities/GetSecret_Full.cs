using System;
using System.Collections.Generic;
using System.Data;
using System.IO;
using System.Linq;
using UiPath.CodedWorkflows;
using UiPath.Platform.ResourceHandling;

namespace CatalogProbeNet8
{
    // tools/ir/gen-coded.ts で IR（GetSecret_Full）から生成。手で直さず IR を直す
    public class GetSecret_Full : CodedWorkflow
    {
        [Workflow]
        public void Execute()
        {
            System.Security.SecureString secret = default;
            // シークレットを取得
            // GetSecret はCoded API が無い（Coded API なし（ISystemService に GetSecret が無い））ので XAML 経由（coded/_activities/GetSecret_25267f.xaml）
            var __xaml1 = RunWorkflow("coded/_activities/GetSecret_25267f.xaml", new Dictionary<string, object> { ["in_AssetName"] = "IRSecret", ["in_FolderPath"] = "Shared", ["in_TimeoutMS"] = 30000 });
            secret = (System.Security.SecureString)__xaml1["out_Secret"];
            Log(message: "シークレットを取得した", level: UiPath.CodedWorkflows.LogLevel.Info);
        }
    }
}
