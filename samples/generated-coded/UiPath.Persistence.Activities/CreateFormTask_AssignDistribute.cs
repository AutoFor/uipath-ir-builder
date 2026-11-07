using System;
using System.Collections.Generic;
using System.Data;
using System.IO;
using System.Linq;
using UiPath.CodedWorkflows;
using UiPath.Platform.ResourceHandling;

namespace CatalogProbeNet8
{
    // tools/ir/gen-coded.ts で IR（CreateFormTask_AssignDistribute）から生成。手で直さず IR を直す
    public class CreateFormTask_AssignDistribute : CodedWorkflow
    {
        [Workflow]
        public void Execute()
        {
            UiPath.Persistence.Activities.FormTask.FormTaskData task1 = default;
            String comment1 = default;
            UiPath.Persistence.Activities.FormTask.FormTaskData task2 = default;
            String comment2 = default;
            // CreateFormTask はCoded API が無い（Coded API なし（1.13.0 の DLL に Coded のサービスが無い。抽出器で services 0 件））ので XAML 経由（coded/_activities/CreateFormTask_e3c3db.xaml）
            var __xaml1 = RunWorkflow("coded/_activities/CreateFormTask_e3c3db.xaml", new Dictionary<string, object> { ["in_FormLayout"] = "[{\"type\":\"textfield\",\"key\":\"Comment\",\"label\":\"コメント\",\"input\":true},{\"type\":\"button\",\"label\":\"Approve\",\"key\":\"approve\",\"theme\":\"primary\",\"input\":true,\"tableView\":false},{\"type\":\"button\",\"label\":\"Reject\",\"key\":\"reject\",\"theme\":\"danger\",\"input\":true,\"tableView\":false}]", ["in_Group"] = "Reviewers", ["in_TaskTitle"] = "順番に割り当てるフォーム" });
            task1 = (UiPath.Persistence.Activities.FormTask.FormTaskData)__xaml1["out_TaskOutput"];
            comment1 = (String)__xaml1["out_FormData_Comment"];
            // CreateFormTask はCoded API が無い（Coded API なし（1.13.0 の DLL に Coded のサービスが無い。抽出器で services 0 件））ので XAML 経由（coded/_activities/CreateFormTask_c735e8.xaml）
            var __xaml2 = RunWorkflow("coded/_activities/CreateFormTask_c735e8.xaml", new Dictionary<string, object> { ["in_FormLayout"] = "[{\"type\":\"textfield\",\"key\":\"Comment\",\"label\":\"コメント\",\"input\":true},{\"type\":\"button\",\"label\":\"Approve\",\"key\":\"approve\",\"theme\":\"primary\",\"input\":true,\"tableView\":false},{\"type\":\"button\",\"label\":\"Reject\",\"key\":\"reject\",\"theme\":\"danger\",\"input\":true,\"tableView\":false}]", ["in_Group"] = "Reviewers", ["in_TaskTitle"] = "作業負荷で割り当てるフォーム" });
            task2 = (UiPath.Persistence.Activities.FormTask.FormTaskData)__xaml2["out_TaskOutput"];
            comment2 = (String)__xaml2["out_FormData_Comment"];
        }
    }
}
