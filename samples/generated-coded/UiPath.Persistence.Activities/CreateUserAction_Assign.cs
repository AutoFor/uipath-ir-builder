using System;
using System.Collections.Generic;
using System.Data;
using System.IO;
using System.Linq;
using UiPath.CodedWorkflows;
using UiPath.Platform.ResourceHandling;

namespace CatalogProbeNet8
{
    // tools/ir/gen-coded.ts で IR（CreateUserAction_Assign）から生成。手で直さず IR を直す
    public class CreateUserAction_Assign : CodedWorkflow
    {
        [Workflow]
        public void Execute()
        {
            UserActionData task1 = default;
            UserActionData task2 = default;
            // CreateUserAction はCoded API が無い（Coded API なし（1.13.0 の DLL に Coded のサービスが無い。抽出器で services 0 件））ので XAML 経由（coded/_activities/CreateUserAction_e75d86.xaml）
            var __xaml1 = RunWorkflow("coded/_activities/CreateUserAction_e75d86.xaml", new Dictionary<string, object> { ["in_SolutionApp"] = "uipath-ir-test-approval", ["in_TaskTitle"] = "アプリをユーザーに割り当てる", ["in_UserNameOrEmail"] = "user@example.com" });
            task1 = (UiPath.Persistence.Activities.UserAction.UserActionData)__xaml1["out_TaskOutput"];
            // CreateUserAction はCoded API が無い（Coded API なし（1.13.0 の DLL に Coded のサービスが無い。抽出器で services 0 件））ので XAML 経由（coded/_activities/CreateUserAction_fc4047.xaml）
            var __xaml2 = RunWorkflow("coded/_activities/CreateUserAction_fc4047.xaml", new Dictionary<string, object> { ["in_Group"] = "Reviewers", ["in_SolutionApp"] = "uipath-ir-test-approval", ["in_TaskTitle"] = "アプリをグループに割り当てる" });
            task2 = (UiPath.Persistence.Activities.UserAction.UserActionData)__xaml2["out_TaskOutput"];
        }
    }
}
