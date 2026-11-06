using System;
using System.Collections.Generic;
using System.Data;
using System.IO;
using System.Linq;
using UiPath.CodedWorkflows;
using UiPath.Platform.ResourceHandling;

namespace CatalogProbeNet8
{
    // tools/ir/gen-coded.ts で IR（CreateFormTask_Min）から生成。手で直さず IR を直す
    public class CreateFormTask_Min : CodedWorkflow
    {
        [Workflow]
        public void Execute()
        {
            FormTaskData task = default;
            // CreateFormTask はCoded API が無い（Coded API なし（1.13.0 の DLL に Coded のサービスが無い。抽出器で services 0 件））ので XAML 経由（coded/_activities/CreateFormTask_d0b6d6.xaml）
            var __xaml1 = RunWorkflow("coded/_activities/CreateFormTask_d0b6d6.xaml", new Dictionary<string, object> { ["in_FormLayout"] = "[{\"type\":\"textfield\",\"key\":\"Comment\",\"label\":\"コメント\",\"input\":true},{\"type\":\"button\",\"label\":\"Approve\",\"key\":\"approve\",\"theme\":\"primary\",\"input\":true,\"tableView\":false}]", ["in_TaskTitle"] = "請求書の確認" });
            task = (UiPath.Persistence.Activities.FormTask.FormTaskData)__xaml1["out_TaskOutput"];
            Log(message: "作成した", level: UiPath.CodedWorkflows.LogLevel.Info);
        }
    }
}
