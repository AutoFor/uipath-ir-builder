using System;
using System.Collections.Generic;
using System.Data;
using System.IO;
using System.Linq;
using UiPath.CodedWorkflows;
using UiPath.Platform.ResourceHandling;

namespace CatalogProbeNet8
{
    // tools/ir/gen-coded.ts で IR（GetAppTasks_Full）から生成。手で直さず IR を直す
    public class GetAppTasks_Full : CodedWorkflow
    {
        [Workflow]
        public void Execute()
        {
            List<UserActionData> tasks = default;
            // タスクを探す
            // GetAppTasks はCoded API が無い（Coded API なし（1.13.0 の DLL に Coded のサービスが無い。抽出器で services 0 件））ので XAML 経由（coded/_activities/GetAppTasks_cba447.xaml）
            var __xaml1 = RunWorkflow("coded/_activities/GetAppTasks_cba447.xaml", new Dictionary<string, object> { ["in_ContinueOnError"] = false, ["in_Expand"] = "AssignedToUser", ["in_Filter"] = "Status eq 'Pending'", ["in_FolderPath"] = "Shared", ["in_OrderBy"] = "Id desc", ["in_Reference"] = "INV-1", ["in_Select"] = "Id,Title", ["in_Skip"] = 0, ["in_TaskCatalogName"] = "InvoiceApproval", ["in_TimeoutMs"] = 30000, ["in_Top"] = 10 });
            tasks = (System.Collections.Generic.List<UiPath.Persistence.Activities.UserAction.UserActionData>)__xaml1["out_TaskObjects"];
            Log(message: "件数: " + tasks.Count.ToString(), level: UiPath.CodedWorkflows.LogLevel.Info);
        }
    }
}
