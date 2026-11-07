using System;
using System.Collections.Generic;
using System.Data;
using System.IO;
using System.Linq;
using UiPath.CodedWorkflows;
using UiPath.Platform.ResourceHandling;

namespace CatalogProbeNet8
{
    // tools/ir/gen-coded.ts で IR（FormTaskApproval_Full）から生成。手で直さず IR を直す
    public class FormTaskApproval_Full : CodedWorkflow
    {
        [Workflow]
        public void Execute(String in_InvoiceNo)
        {
            UiPath.Persistence.Activities.FormTask.FormTaskData task = default;
            String action = default;
            String comment = default;
            // 承認タスクを作る
            // CreateFormTask はCoded API が無い（Coded API なし（1.13.0 の DLL に Coded のサービスが無い。抽出器で services 0 件））ので XAML 経由（coded/_activities/CreateFormTask_7e098d.xaml）
            var __xaml1 = RunWorkflow("coded/_activities/CreateFormTask_7e098d.xaml", new Dictionary<string, object> { ["in_ExternalTag"] = in_InvoiceNo, ["in_FormLayout"] = "[{\"type\":\"textfield\",\"key\":\"InvoiceNo\",\"label\":\"請求書\",\"input\":true,\"disabled\":true},{\"type\":\"textfield\",\"key\":\"Comment\",\"label\":\"コメント\",\"input\":true},{\"type\":\"button\",\"label\":\"Approve\",\"key\":\"Approve\",\"theme\":\"primary\",\"input\":false,\"tableView\":false},{\"type\":\"button\",\"label\":\"Reject\",\"key\":\"Reject\",\"theme\":\"danger\",\"input\":false,\"tableView\":false}]", ["in_Labels"] = "invoice", ["in_TaskTitle"] = "請求書の確認: " + in_InvoiceNo, ["in_FormData_InvoiceNo"] = in_InvoiceNo });
            task = (UiPath.Persistence.Activities.FormTask.FormTaskData)__xaml1["out_TaskOutput"];
            comment = (String)__xaml1["out_FormData_Comment"];
            // 人の判断を待つ
            // WaitForFormTaskAndResume はCoded API が無い（Coded API なし（1.13.0 の DLL に Coded のサービスが無い。抽出器で services 0 件））ので XAML 経由（coded/_activities/WaitForFormTaskAndResume_102572.xaml）
            var __xaml2 = RunWorkflow("coded/_activities/WaitForFormTaskAndResume_102572.xaml", new Dictionary<string, object> { ["in_StatusMessage"] = "承認待ち", ["in_TaskInput"] = task });
            action = (System.String)__xaml2["out_TaskAction"];
            task = (UiPath.Persistence.Activities.FormTask.FormTaskData)__xaml2["out_TaskOutput"];
            if (action == "Approve")
            {
                Log(message: "承認: " + comment, level: UiPath.CodedWorkflows.LogLevel.Info);
            }
            else
            {
                Log(message: "却下: " + comment, level: UiPath.CodedWorkflows.LogLevel.Warn);
            }
        }
    }
}
