using System;
using System.Collections.Generic;
using System.Data;
using System.IO;
using System.Linq;
using UiPath.CodedWorkflows;
using UiPath.Platform.ResourceHandling;

namespace CatalogProbeNet8
{
    // tools/ir/gen-coded.ts で IR（CreateUserAction_Solution）から生成。手で直さず IR を直す
    public class CreateUserAction_Solution : CodedWorkflow
    {
        [Workflow]
        public void Execute()
        {
            UserActionData task = default;
            // CreateUserAction はCoded API が無い（Coded API なし（1.13.0 の DLL に Coded のサービスが無い。抽出器で services 0 件））ので XAML 経由（coded/_activities/CreateUserAction_352ffc.xaml）
            var __xaml1 = RunWorkflow("coded/_activities/CreateUserAction_352ffc.xaml", new Dictionary<string, object> { ["in_ReassignGroup"] = "Reviewers", ["in_ReassignUser"] = "user@example.com", ["in_SolutionApp"] = "InvoiceApp", ["in_SolutionTaskCatalog"] = "InvoiceApproval", ["in_TaskFieldsForWeb"] = new String[] { "No" }, ["in_TaskTitle"] = "アプリで確認", ["in_UserNameOrEmail"] = "user@example.com" });
            task = (UiPath.Persistence.Activities.UserAction.UserActionData)__xaml1["out_TaskOutput"];
        }
    }
}
