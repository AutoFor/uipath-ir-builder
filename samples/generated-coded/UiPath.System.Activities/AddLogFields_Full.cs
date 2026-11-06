using System;
using System.Collections.Generic;
using System.Data;
using System.IO;
using System.Linq;
using UiPath.CodedWorkflows;
using UiPath.Platform.ResourceHandling;

namespace CatalogProbeNet8
{
    // tools/ir/gen-coded.ts で IR（AddLogFields_Full）から生成。手で直さず IR を直す
    public class AddLogFields_Full : CodedWorkflow
    {
        [Workflow]
        public void Execute()
        {
            Int32 n = 7;
            // 固定の項目と式の項目を足す
            // AddLogFields はCoded API が無い（Coded API なし（基底クラスの Log の additionalLogFields で、ログ1件ごとに渡す））ので XAML 経由（coded/_activities/AddLogFields_ba4af6.xaml）
            RunWorkflow("coded/_activities/AddLogFields_ba4af6.xaml", new Dictionary<string, object> { ["in_Fields_case_id"] = "A-002", ["in_Fields_count"] = n * 2, ["in_Fields_flag"] = n > 5 });
            Log(message: "n=" + n.ToString(), level: UiPath.CodedWorkflows.LogLevel.Info);
            // 同じ名前を上書き
            // AddLogFields はCoded API が無い（Coded API なし（基底クラスの Log の additionalLogFields で、ログ1件ごとに渡す））ので XAML 経由（coded/_activities/AddLogFields_2c868e.xaml）
            RunWorkflow("coded/_activities/AddLogFields_2c868e.xaml", new Dictionary<string, object> { ["in_Fields_case_id"] = "A-003" });
            Log(message: "上書きした後", level: UiPath.CodedWorkflows.LogLevel.Warn);
        }
    }
}
