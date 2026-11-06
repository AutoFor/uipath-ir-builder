using System;
using System.Collections.Generic;
using System.Data;
using System.IO;
using System.Linq;
using UiPath.CodedWorkflows;
using UiPath.Platform.ResourceHandling;

namespace CatalogProbeNet8
{
    // tools/ir/gen-coded.ts で IR（RemoveLogFields_Min）から生成。手で直さず IR を直す
    public class RemoveLogFields_Min : CodedWorkflow
    {
        [Workflow]
        public void Execute()
        {
            // AddLogFields はCoded API が無い（Coded API なし（基底クラスの Log の additionalLogFields で、ログ1件ごとに渡す））ので XAML 経由（coded/_xaml/RemoveLogFields_Min_1.xaml）
            RunWorkflow("coded/_xaml/RemoveLogFields_Min_1.xaml", null);
            // RemoveLogFields はCoded API が無い（Coded API なし（基底クラスの Log の additionalLogFields はログ1件ごとに渡す形で、AddLogFields のように以降のログへ残る項目も、それを消す API も無い））ので XAML 経由（coded/_xaml/RemoveLogFields_Min_2.xaml）
            RunWorkflow("coded/_xaml/RemoveLogFields_Min_2.xaml", null);
            Log(message: "項目を消した後のログ", level: UiPath.CodedWorkflows.LogLevel.Info);
        }
    }
}
