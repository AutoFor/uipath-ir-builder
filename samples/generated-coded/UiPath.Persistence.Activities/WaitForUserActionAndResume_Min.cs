using System;
using System.Collections.Generic;
using System.Data;
using System.IO;
using System.Linq;
using UiPath.CodedWorkflows;
using UiPath.Platform.ResourceHandling;

namespace CatalogProbeNet8
{
    // tools/ir/gen-coded.ts で IR（WaitForUserActionAndResume_Min）から生成。手で直さず IR を直す
    public class WaitForUserActionAndResume_Min : CodedWorkflow
    {
        [Workflow]
        public void Execute()
        {
            UserActionData task = default;
            String action = default;
            // CreateUserAction はCoded API が無い（Coded API なし（1.13.0 の DLL に Coded のサービスが無い。抽出器で services 0 件））ので XAML 経由（coded/_activities/CreateUserAction_78ba75.xaml）
            var __xaml1 = RunWorkflow("coded/_activities/CreateUserAction_78ba75.xaml", new Dictionary<string, object> { ["in_SolutionApp"] = "uipath-ir-test-approval", ["in_TaskTitle"] = "アプリで確認" });
            task = (UiPath.Persistence.Activities.UserAction.UserActionData)__xaml1["out_TaskOutput"];
            // WaitForUserActionAndResume はCoded API が無い（Coded API なし（1.13.0 の DLL に Coded のサービスが無い。抽出器で services 0 件））ので XAML 経由（coded/_activities/WaitForUserActionAndResume_08ff35.xaml）
            var __xaml2 = RunWorkflow("coded/_activities/WaitForUserActionAndResume_08ff35.xaml", new Dictionary<string, object> { ["in_TaskInput"] = task });
            action = (System.String)__xaml2["out_TaskAction"];
            Log(message: "結果: " + action, level: UiPath.CodedWorkflows.LogLevel.Info);
        }
    }
}
