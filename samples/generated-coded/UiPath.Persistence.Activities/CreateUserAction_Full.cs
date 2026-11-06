using System;
using System.Collections.Generic;
using System.Data;
using System.IO;
using System.Linq;
using UiPath.CodedWorkflows;
using UiPath.Platform.ResourceHandling;

namespace CatalogProbeNet8
{
    // tools/ir/gen-coded.ts で IR（CreateUserAction_Full）から生成。手で直さず IR を直す
    public class CreateUserAction_Full : CodedWorkflow
    {
        [Workflow]
        public void Execute()
        {
            UserActionData task = default;
            // App タスクを作る
            // CreateUserAction はCoded API が無い（Coded API なし（1.13.0 の DLL に Coded のサービスが無い。抽出器で services 0 件））ので XAML 経由（coded/_activities/CreateUserAction_484264.xaml）
            var __xaml1 = RunWorkflow("coded/_activities/CreateUserAction_484264.xaml", new Dictionary<string, object> { ["in_ExternalTag"] = "INV-1", ["in_FolderPath"] = "Shared", ["in_Group"] = "Reviewers", ["in_Labels"] = "invoice", ["in_PrimaryButtonLabel"] = "承認", ["in_SecondaryButtonLabel"] = "却下", ["in_SolutionApp"] = "uipath-ir-test-approval", ["in_TaskCatalog"] = "InvoiceApproval", ["in_TaskTitle"] = "アプリで確認", ["in_TimeoutMs"] = 30000, ["in_TimerDuration"] = TimeSpan.FromHours(4), ["in_AppActionData_No"] = "INV-1" });
            task = (UiPath.Persistence.Activities.UserAction.UserActionData)__xaml1["out_TaskOutput"];
        }
    }
}
