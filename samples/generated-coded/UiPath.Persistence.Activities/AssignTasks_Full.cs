using System;
using System.Collections.Generic;
using System.Data;
using System.IO;
using System.Linq;
using UiPath.CodedWorkflows;
using UiPath.Platform.ResourceHandling;

namespace CatalogProbeNet8
{
    // tools/ir/gen-coded.ts で IR（AssignTasks_Full）から生成。手で直さず IR を直す
    public class AssignTasks_Full : CodedWorkflow
    {
        [Workflow]
        public void Execute(Int64 in_TaskId)
        {
            List<UiPath.Persistence.Activities.Tasks.TaskAssignmentResponse> failed = default;
            // 担当を替える
            // AssignTasks はCoded API が無い（Coded API なし（1.13.0 の DLL に Coded のサービスが無い。抽出器で services 0 件））ので XAML 経由（coded/_activities/AssignTasks_67299f.xaml）
            var __xaml1 = RunWorkflow("coded/_activities/AssignTasks_67299f.xaml", new Dictionary<string, object> { ["in_ContinueOnError"] = false, ["in_FolderPath"] = "Shared", ["in_Group"] = "Reviewers", ["in_TaskId"] = in_TaskId, ["in_TimeoutMs"] = 30000, ["in_UserNameOrEmail"] = "user@example.com" });
            failed = (System.Collections.Generic.List<UiPath.Persistence.Activities.Tasks.TaskAssignmentResponse>)__xaml1["out_FailedTaskAssignments"];
            Log(message: "失敗: " + failed.Count.ToString(), level: UiPath.CodedWorkflows.LogLevel.Info);
        }
    }
}
