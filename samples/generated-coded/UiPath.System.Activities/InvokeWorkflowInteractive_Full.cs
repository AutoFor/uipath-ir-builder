using System;
using System.Collections.Generic;
using System.Data;
using System.IO;
using System.Linq;
using UiPath.CodedWorkflows;
using UiPath.Platform.ResourceHandling;

namespace CatalogProbeNet8
{
    // tools/ir/gen-coded.ts で IR（InvokeWorkflowInteractive_Full）から生成。手で直さず IR を直す
    public class InvokeWorkflowInteractive_Full : CodedWorkflow
    {
        [Workflow]
        public void Execute()
        {
            String msg = default;
            // 対話で呼ぶ
            // InvokeWorkflowInteractive はCoded API が無い（Coded API なし（対話セッションでのワークフロー呼び出しの API が無い））ので XAML 経由（coded/_activities/InvokeWorkflowInteractive_4e0b30.xaml）
            var __xaml1 = RunWorkflow("coded/_activities/InvokeWorkflowInteractive_4e0b30.xaml", new Dictionary<string, object> { ["in_ContinueOnError"] = false, ["in_Timeout"] = TimeSpan.FromSeconds(30), ["in_WorkflowFileName"] = "InvokeWorkflowFile_Callee.xaml", ["in_Arguments_in_Count"] = 3, ["in_Arguments_in_Name"] = "次郎" });
            msg = (String)__xaml1["out_Arguments_out_Message"];
            Log(message: "呼んだ", level: UiPath.CodedWorkflows.LogLevel.Info);
        }
    }
}
