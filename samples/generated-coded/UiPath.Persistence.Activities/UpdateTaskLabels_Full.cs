using System;
using System.Collections.Generic;
using System.Data;
using System.IO;
using System.Linq;
using UiPath.CodedWorkflows;
using UiPath.Platform.ResourceHandling;

namespace CatalogProbeNet8
{
    // tools/ir/gen-coded.ts で IR（UpdateTaskLabels_Full）から生成。手で直さず IR を直す
    public class UpdateTaskLabels_Full : CodedWorkflow
    {
        [Workflow]
        public void Execute(Int64 in_TaskId)
        {
            // ラベルを変える
            // UpdateTaskLabels はCoded API が無い（Coded API なし（1.13.0 の DLL に Coded のサービスが無い。抽出器で services 0 件））ので XAML 経由（coded/_activities/UpdateTaskLabels_2fa4ef.xaml）
            RunWorkflow("coded/_activities/UpdateTaskLabels_2fa4ef.xaml", new Dictionary<string, object> { ["in_AddLabels"] = "invoice", ["in_ContinueOnError"] = false, ["in_DeleteLabels"] = "draft", ["in_FolderPath"] = "Shared", ["in_TaskId"] = in_TaskId, ["in_TimeoutMs"] = 30000 });
        }
    }
}
