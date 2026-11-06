using System;
using System.Collections.Generic;
using System.Data;
using System.IO;
using System.Linq;
using UiPath.CodedWorkflows;
using UiPath.Platform.ResourceHandling;

namespace CatalogProbeNet8
{
    // tools/ir/gen-coded.ts で IR（FormTaskAssign_Full）から生成。手で直さず IR を直す
    public class FormTaskAssign_Full : CodedWorkflow
    {
        [Workflow]
        public void Execute(String in_Assignee)
        {
            FormTaskData task = default;
            String comment = default;
            String action = default;
            // CreateFormTask はCoded API が無い（Coded API なし（1.13.0 の DLL に Coded のサービスが無い。抽出器で services 0 件））ので XAML 経由（coded/_activities/CreateFormTask_eb56f0.xaml）
            var __xaml1 = RunWorkflow("coded/_activities/CreateFormTask_eb56f0.xaml", new Dictionary<string, object> { ["in_FormLayout"] = "[{\"type\":\"textfield\",\"key\":\"Comment\",\"label\":\"コメント\",\"input\":true},{\"type\":\"button\",\"label\":\"Approve\",\"key\":\"approve\",\"theme\":\"primary\",\"input\":true,\"tableView\":false},{\"type\":\"button\",\"label\":\"Reject\",\"key\":\"reject\",\"theme\":\"danger\",\"input\":true,\"tableView\":false}]", ["in_TaskTitle"] = "割り当ての確認", ["in_UserNameOrEmail"] = in_Assignee });
            task = (UiPath.Persistence.Activities.FormTask.FormTaskData)__xaml1["out_TaskOutput"];
            comment = (String)__xaml1["out_FormData_Comment"];
            Log(message: "created id=" + Convert.ToString(task.Id) + " assignee=" + in_Assignee, level: UiPath.CodedWorkflows.LogLevel.Info);
            // WaitForFormTaskAndResume はCoded API が無い（Coded API なし（1.13.0 の DLL に Coded のサービスが無い。抽出器で services 0 件））ので XAML 経由（coded/_activities/WaitForFormTaskAndResume_047385.xaml）
            var __xaml2 = RunWorkflow("coded/_activities/WaitForFormTaskAndResume_047385.xaml", new Dictionary<string, object> { ["in_TaskInput"] = task });
            action = (System.String)__xaml2["out_TaskAction"];
            task = (UiPath.Persistence.Activities.FormTask.FormTaskData)__xaml2["out_TaskOutput"];
            Log(message: "resume action=" + action + " comment=" + comment, level: UiPath.CodedWorkflows.LogLevel.Info);
        }
    }
}
