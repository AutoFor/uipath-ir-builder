using System;
using System.Collections.Generic;
using System.Data;
using System.IO;
using System.Linq;
using UiPath.CodedWorkflows;
using UiPath.Platform.ResourceHandling;

namespace CatalogProbeNet8
{
    // tools/ir/gen-coded.ts で IR（PropForms）から生成。手で直さず IR を直す
    public class PropForms : CodedWorkflow
    {
        [Workflow]
        public void Execute()
        {
            Int32 y = 0;
            // ログに項目を足す
            // AddLogFields はCoded API が無い（Coded API なし（基底クラスの Log の additionalLogFields で、ログ1件ごとに渡す））ので XAML 経由（coded/_xaml/PropForms_1.xaml）
            RunWorkflow("coded/_xaml/PropForms_1.xaml", null);
            // コードを呼ぶ
            // InvokeCode はCoded API が無い（Coded では C# をそのまま書くので InvokeCode は要らない）ので XAML 経由（coded/_xaml/PropForms_2.xaml）
            var __xaml1 = RunWorkflow("coded/_xaml/PropForms_2.xaml", new Dictionary<string, object> { ["y"] = y });
            y = (Int32)__xaml1["y"];
            Log(message: "y=" + y.ToString(), level: UiPath.CodedWorkflows.LogLevel.Info);
        }
    }
}
