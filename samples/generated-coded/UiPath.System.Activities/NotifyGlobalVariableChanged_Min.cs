using System;
using System.Collections.Generic;
using System.Data;
using System.IO;
using System.Linq;
using UiPath.CodedWorkflows;
using UiPath.Platform.ResourceHandling;

namespace CatalogProbeNet8
{
    // tools/ir/gen-coded.ts で IR（NotifyGlobalVariableChanged_Min）から生成。手で直さず IR を直す
    public class NotifyGlobalVariableChanged_Min : CodedWorkflow
    {
        [Workflow]
        public void Execute()
        {
            // NotifyGlobalVariableChanged はCoded API が無い（Coded API なし（グローバル変数の通知 API が無い））ので XAML 経由（coded/_activities/NotifyGlobalVariableChanged.xaml）
            RunWorkflow("coded/_activities/NotifyGlobalVariableChanged.xaml", new Dictionary<string, object> { ["in_VariableName"] = "IrVar" });
            Log(message: "通知した", level: UiPath.CodedWorkflows.LogLevel.Info);
        }
    }
}
