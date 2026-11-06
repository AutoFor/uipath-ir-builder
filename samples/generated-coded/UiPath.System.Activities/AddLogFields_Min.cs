using System;
using System.Collections.Generic;
using System.Data;
using System.IO;
using System.Linq;
using UiPath.CodedWorkflows;
using UiPath.Platform.ResourceHandling;

namespace CatalogProbeNet8
{
    // tools/ir/gen-coded.ts で IR（AddLogFields_Min）から生成。手で直さず IR を直す
    public class AddLogFields_Min : CodedWorkflow
    {
        [Workflow]
        public void Execute()
        {
            // AddLogFields はCoded API が無い（Coded API なし（基底クラスの Log の additionalLogFields で、ログ1件ごとに渡す））ので XAML 経由（coded/_xaml/AddLogFields_Min_1.xaml）
            RunWorkflow("coded/_xaml/AddLogFields_Min_1.xaml", null);
            Log(message: "項目を足した後のログ", level: UiPath.CodedWorkflows.LogLevel.Info);
        }
    }
}
