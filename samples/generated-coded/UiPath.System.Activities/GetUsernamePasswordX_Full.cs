using System;
using System.Collections.Generic;
using System.Data;
using System.IO;
using System.Linq;
using UiPath.CodedWorkflows;
using UiPath.Platform.ResourceHandling;

namespace CatalogProbeNet8
{
    // tools/ir/gen-coded.ts で IR（GetUsernamePasswordX_Full）から生成。手で直さず IR を直す
    public class GetUsernamePasswordX_Full : CodedWorkflow
    {
        [Workflow]
        public void Execute()
        {
            PasswordCredentials cred = default;
            // ユーザー名とパスワードを取得
            // GetUsernamePasswordX はCoded API が無い（Coded API なし（ISystemService に対応するメソッドが無い。認証情報の入力ダイアログを開く XAML 専用のアクティビティ））ので XAML 経由（coded/_xaml/GetUsernamePasswordX_Full_1.xaml）
            var __xaml1 = RunWorkflow("coded/_xaml/GetUsernamePasswordX_Full_1.xaml", new Dictionary<string, object> { ["cred"] = cred });
            cred = (PasswordCredentials)__xaml1["cred"];
            Log(message: "ユーザー: " + cred.Username, level: UiPath.CodedWorkflows.LogLevel.Info);
        }
    }
}
