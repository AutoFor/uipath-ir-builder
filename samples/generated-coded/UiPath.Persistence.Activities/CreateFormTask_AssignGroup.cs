using System;
using System.Collections.Generic;
using System.Data;
using System.IO;
using System.Linq;
using UiPath.CodedWorkflows;
using UiPath.Platform.ResourceHandling;

namespace CatalogProbeNet8
{
    // tools/ir/gen-coded.ts で IR（CreateFormTask_AssignGroup）から生成。手で直さず IR を直す
    public class CreateFormTask_AssignGroup : CodedWorkflow
    {
        [Workflow]
        public void Execute()
        {
            UiPath.Persistence.Activities.FormTask.FormTaskData task = default;
            String comment = default;
            // CreateFormTask はCoded API が無い（Coded API なし（1.13.0 の DLL に Coded のサービスが無い。抽出器で services 0 件））ので XAML 経由（coded/_activities/CreateFormTask_4cf0ba.xaml）
            var __xaml1 = RunWorkflow("coded/_activities/CreateFormTask_4cf0ba.xaml", new Dictionary<string, object> { ["in_FormLayout"] = "[{\"type\":\"textfield\",\"key\":\"Comment\",\"label\":\"コメント\",\"input\":true},{\"type\":\"button\",\"label\":\"Approve\",\"key\":\"approve\",\"theme\":\"primary\",\"input\":true,\"tableView\":false},{\"type\":\"button\",\"label\":\"Reject\",\"key\":\"reject\",\"theme\":\"danger\",\"input\":true,\"tableView\":false}]", ["in_Group"] = "Reviewers", ["in_TaskTitle"] = "グループの全員に割り当てるフォーム" });
            task = (UiPath.Persistence.Activities.FormTask.FormTaskData)__xaml1["out_TaskOutput"];
            comment = (String)__xaml1["out_FormData_Comment"];
        }
    }
}
