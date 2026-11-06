using System;
using System.Collections.Generic;
using System.Data;
using System.IO;
using System.Linq;
using UiPath.CodedWorkflows;
using UiPath.Platform.ResourceHandling;

namespace CatalogProbeNet8
{
    // tools/ir/gen-coded.ts で IR（RemoveLogFields_Full）から生成。手で直さず IR を直す
    public class RemoveLogFields_Full : CodedWorkflow
    {
        [Workflow]
        public void Execute()
        {
            String key = "step";
            // AddLogFields はCoded API が無い（Coded API なし（基底クラスの Log の additionalLogFields で、ログ1件ごとに渡す））ので XAML 経由（coded/_xaml/RemoveLogFields_Full_1.xaml）
            RunWorkflow("coded/_xaml/RemoveLogFields_Full_1.xaml", null);
            Log(message: "3項目あり", level: UiPath.CodedWorkflows.LogLevel.Info);
            // 固定名と式で2項目を消す
            // RemoveLogFields はCoded API が無い（Coded API なし（基底クラスの Log の additionalLogFields はログ1件ごとに渡す形で、AddLogFields のように以降のログへ残る項目も、それを消す API も無い））ので XAML 経由（coded/_xaml/RemoveLogFields_Full_2.xaml）
            RunWorkflow("coded/_xaml/RemoveLogFields_Full_2.xaml", new Dictionary<string, object> { ["key"] = key });
            Log(message: "keep だけ残った", level: UiPath.CodedWorkflows.LogLevel.Info);
            // 無い名前を消しても落ちない
            // RemoveLogFields はCoded API が無い（Coded API なし（基底クラスの Log の additionalLogFields はログ1件ごとに渡す形で、AddLogFields のように以降のログへ残る項目も、それを消す API も無い））ので XAML 経由（coded/_xaml/RemoveLogFields_Full_3.xaml）
            RunWorkflow("coded/_xaml/RemoveLogFields_Full_3.xaml", null);
            Log(message: "無い名前を消した後", level: UiPath.CodedWorkflows.LogLevel.Info);
        }
    }
}
