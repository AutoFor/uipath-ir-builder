using System;
using System.Collections.Generic;
using System.Data;
using System.IO;
using System.Linq;
using UiPath.CodedWorkflows;
using UiPath.Platform.ResourceHandling;

namespace CatalogProbeNet8
{
    // tools/ir/gen-coded.ts で IR（InvokeWorkflowInteractive_Var）から生成。手で直さず IR を直す
    public class InvokeWorkflowInteractive_Var : CodedWorkflow
    {
        [Workflow]
        public void Execute()
        {
            Dictionary<String, Object> av = new Dictionary<String, Object>() { { "in_Name", "三郎" } };
            // InvokeWorkflowInteractive はCoded API が無い（Coded API なし（対話セッションでのワークフロー呼び出しの API が無い））ので XAML 経由（coded/_xaml/InvokeWorkflowInteractive_Var_1.xaml）
            RunWorkflow("coded/_xaml/InvokeWorkflowInteractive_Var_1.xaml", new Dictionary<string, object> { ["av"] = av });
            Log(message: "呼んだ", level: UiPath.CodedWorkflows.LogLevel.Info);
        }
    }
}
