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
            // InvokeWorkflowInteractive はCoded API が無い（Coded API なし（対話セッションでのワークフロー呼び出しの API が無い））ので XAML 経由（coded/_xaml/InvokeWorkflowInteractive_Full_1.xaml）
            var __xaml1 = RunWorkflow("coded/_xaml/InvokeWorkflowInteractive_Full_1.xaml", new Dictionary<string, object> { ["msg"] = msg });
            msg = (String)__xaml1["msg"];
            Log(message: "呼んだ", level: UiPath.CodedWorkflows.LogLevel.Info);
        }
    }
}
