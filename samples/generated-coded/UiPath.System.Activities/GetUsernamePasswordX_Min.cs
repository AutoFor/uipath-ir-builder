using System;
using System.Collections.Generic;
using System.Data;
using System.IO;
using System.Linq;
using UiPath.CodedWorkflows;
using UiPath.Platform.ResourceHandling;

namespace CatalogProbeNet8
{
    // tools/ir/gen-coded.ts で IR（GetUsernamePasswordX_Min）から生成。手で直さず IR を直す
    public class GetUsernamePasswordX_Min : CodedWorkflow
    {
        [Workflow]
        public void Execute()
        {
            UiPath.Core.Activities.PasswordCredentials cred = default;
            // GetUsernamePasswordX はCoded API が無い（Coded API なし（ISystemService に対応するメソッドが無い。認証情報の入力ダイアログを開く XAML 専用のアクティビティ））ので XAML 経由（coded/_activities/GetUsernamePasswordX_574cc9.xaml）
            var __xaml1 = RunWorkflow("coded/_activities/GetUsernamePasswordX_574cc9.xaml", new Dictionary<string, object> { ["in_CredentialName"] = "IRCredential" });
            cred = (UiPath.Core.Activities.PasswordCredentials)__xaml1["out_Credential"];
            Log(message: "ユーザー: " + cred.Username, level: UiPath.CodedWorkflows.LogLevel.Info);
        }
    }
}
