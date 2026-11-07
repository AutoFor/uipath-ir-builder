using System;
using System.Collections.Generic;
using System.Data;
using System.IO;
using System.Linq;
using UiPath.CodedWorkflows;
using UiPath.Platform.ResourceHandling;

namespace CatalogProbeNet8
{
    // tools/ir/gen-coded.ts で IR（CreateFormTask_Timer）から生成。手で直さず IR を直す
    public class CreateFormTask_Timer : CodedWorkflow
    {
        [Workflow]
        public void Execute()
        {
            UiPath.Persistence.Activities.FormTask.FormTaskData task = default;
            // CreateFormTask はCoded API が無い（Coded API なし（1.13.0 の DLL に Coded のサービスが無い。抽出器で services 0 件））ので XAML 経由（coded/_activities/CreateFormTask_61ae6d.xaml）
            var __xaml1 = RunWorkflow("coded/_activities/CreateFormTask_61ae6d.xaml", new Dictionary<string, object> { ["in_BucketFolderPath"] = "Shared", ["in_BucketName"] = "Forms", ["in_ContinueOnError"] = false, ["in_FolderPath"] = "Shared", ["in_FormLayout"] = "[{\"type\":\"textfield\",\"key\":\"Comment\",\"label\":\"コメント\",\"input\":true},{\"type\":\"button\",\"label\":\"Approve\",\"key\":\"approve\",\"theme\":\"primary\",\"input\":true,\"tableView\":false}]", ["in_Group"] = "Reviewers", ["in_ReassignGroup"] = "Reviewers", ["in_ReassignUser"] = "user@example.com", ["in_TaskTitle"] = "期限付きのフォーム", ["in_TimeoutMs"] = 30000, ["in_TimerDuration"] = TimeSpan.FromHours(4), ["in_UserNameOrEmail"] = "user@example.com" });
            task = (UiPath.Persistence.Activities.FormTask.FormTaskData)__xaml1["out_TaskOutput"];
        }
    }
}
