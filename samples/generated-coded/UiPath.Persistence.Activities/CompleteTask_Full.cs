using System;
using System.Collections.Generic;
using System.Data;
using System.IO;
using System.Linq;
using UiPath.CodedWorkflows;
using UiPath.Platform.ResourceHandling;

namespace CatalogProbeNet8
{
    // tools/ir/gen-coded.ts で IR（CompleteTask_Full）から生成。手で直さず IR を直す
    public class CompleteTask_Full : CodedWorkflow
    {
        [Workflow]
        public void Execute(Int64 in_TaskId)
        {
            // 完了にする
            // CompleteTask はCoded API が無い（Coded API なし（1.13.0 の DLL に Coded のサービスが無い。抽出器で services 0 件））ので XAML 経由（coded/_activities/CompleteTask_63efcf.xaml）
            RunWorkflow("coded/_activities/CompleteTask_63efcf.xaml", new Dictionary<string, object> { ["in_Action"] = "Approve", ["in_ContinueOnError"] = false, ["in_Data"] = new Newtonsoft.Json.Linq.JObject(), ["in_FolderPath"] = "Shared", ["in_TaskId"] = in_TaskId, ["in_TimeoutMs"] = 30000 });
        }
    }
}
