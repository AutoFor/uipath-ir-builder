using System;
using System.Collections.Generic;
using System.Data;
using System.IO;
using System.Linq;
using UiPath.CodedWorkflows;
using UiPath.Platform.ResourceHandling;

namespace CatalogProbeNet8
{
    // tools/ir/gen-coded.ts で IR（SetSecret_Full）から生成。手で直さず IR を直す
    public class SetSecret_Full : CodedWorkflow
    {
        [Workflow]
        public void Execute()
        {
            // シークレットを設定
            // SetSecret はCoded API が無い（Coded API なし（ISystemService に SetSecret が無い））ので XAML 経由（coded/_activities/SetSecret_6efc5c.xaml）
            RunWorkflow("coded/_activities/SetSecret_6efc5c.xaml", new Dictionary<string, object> { ["in_AssetName"] = "IRSecret", ["in_ContinueOnError"] = false, ["in_FolderPath"] = "Shared", ["in_SecretValue"] = "s2", ["in_TimeoutMS"] = 30000 });
            Log(message: "シークレットを設定した", level: UiPath.CodedWorkflows.LogLevel.Info);
        }
    }
}
