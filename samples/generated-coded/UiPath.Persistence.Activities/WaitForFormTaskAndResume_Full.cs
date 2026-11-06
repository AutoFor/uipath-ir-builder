using System;
using System.Collections.Generic;
using System.Data;
using System.IO;
using System.Linq;
using UiPath.CodedWorkflows;
using UiPath.Platform.ResourceHandling;

namespace CatalogProbeNet8
{
    // tools/ir/gen-coded.ts で IR（WaitForFormTaskAndResume_Full）から生成。手で直さず IR を直す
    public class WaitForFormTaskAndResume_Full : CodedWorkflow
    {
        [Workflow]
        public void Execute()
        {
            FormTaskData task = default;
            String action = default;
            // CreateFormTask はCoded API が無い（Coded API なし（1.13.0 の DLL に Coded のサービスが無い。抽出器で services 0 件））ので XAML 経由（coded/_activities/CreateFormTask_d0b6d6.xaml）
            var __xaml1 = RunWorkflow("coded/_activities/CreateFormTask_d0b6d6.xaml", new Dictionary<string, object> { ["in_FormLayout"] = "[{\"type\":\"textfield\",\"key\":\"Comment\",\"label\":\"コメント\",\"input\":true},{\"type\":\"button\",\"label\":\"Approve\",\"key\":\"approve\",\"theme\":\"primary\",\"input\":true,\"tableView\":false}]", ["in_TaskTitle"] = "確認" });
            task = (UiPath.Persistence.Activities.FormTask.FormTaskData)__xaml1["out_TaskOutput"];
            // 人の判断を待つ
            // WaitForFormTaskAndResume はCoded API が無い（Coded API なし（1.13.0 の DLL に Coded のサービスが無い。抽出器で services 0 件））ので XAML 経由（coded/_activities/WaitForFormTaskAndResume_4b664d.xaml）
            var __xaml2 = RunWorkflow("coded/_activities/WaitForFormTaskAndResume_4b664d.xaml", new Dictionary<string, object> { ["in_ContinueOnError"] = false, ["in_StatusMessage"] = "承認待ち", ["in_TaskInput"] = task, ["in_TimeoutMs"] = 30000, ["io_WaitItemDataObject"] = task });
            action = (System.String)__xaml2["out_TaskAction"];
            task = (UiPath.Persistence.Activities.FormTask.FormTaskData)__xaml2["out_TaskOutput"];
            task = (UiPath.Persistence.Activities.FormTask.FormTaskData)__xaml2["io_WaitItemDataObject"];
        }
    }
}
