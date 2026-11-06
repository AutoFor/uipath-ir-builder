using System;
using System.Collections.Generic;
using System.Data;
using System.IO;
using System.Linq;
using UiPath.CodedWorkflows;
using UiPath.Platform.ResourceHandling;

namespace CatalogProbeNet8
{
    // tools/ir/gen-coded.ts で IR（CreateFormTask_Layout）から生成。手で直さず IR を直す
    public class CreateFormTask_Layout : CodedWorkflow
    {
        [Workflow]
        public void Execute()
        {
            FormTaskData task = default;
            String comment = default;
            // CreateFormTask はCoded API が無い（Coded API なし（1.13.0 の DLL に Coded のサービスが無い。抽出器で services 0 件））ので XAML 経由（coded/_activities/CreateFormTask_092e01.xaml）
            var __xaml1 = RunWorkflow("coded/_activities/CreateFormTask_092e01.xaml", new Dictionary<string, object> { ["in_FormLayout"] = "[{\"type\":\"textfield\",\"key\":\"Comment\",\"label\":\"コメント\",\"input\":true},{\"type\":\"button\",\"label\":\"Approve\",\"key\":\"approve\",\"theme\":\"primary\",\"input\":true,\"tableView\":false}]", ["in_TaskTitle"] = "レイアウト付きのフォーム" });
            task = (UiPath.Persistence.Activities.FormTask.FormTaskData)__xaml1["out_TaskOutput"];
            comment = (String)__xaml1["out_FormData_Comment"];
        }
    }
}
