using System;
using System.Collections.Generic;
using System.Data;
using System.IO;
using System.Linq;
using UiPath.CodedWorkflows;
using UiPath.Platform.ResourceHandling;

namespace CatalogProbeNet8
{
    // tools/ir/gen-coded.ts で IR（InvokeWorkflowInteractive_Min）から生成。手で直さず IR を直す
    public class InvokeWorkflowInteractive_Min : CodedWorkflow
    {
        [Workflow]
        public void Execute()
        {
            // InvokeWorkflowInteractive はCoded API が無い（Coded API なし（対話セッションでのワークフロー呼び出しの API が無い））ので XAML 経由（coded/_activities/InvokeWorkflowInteractive.xaml）
            RunWorkflow("coded/_activities/InvokeWorkflowInteractive.xaml", new Dictionary<string, object> { ["in_WorkflowFileName"] = "InvokeWorkflowFile_Callee.xaml" });
            Log(message: "呼んだ", level: UiPath.CodedWorkflows.LogLevel.Info);
        }
    }
}
