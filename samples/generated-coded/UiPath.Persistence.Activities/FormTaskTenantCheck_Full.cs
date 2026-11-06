using System;
using System.Collections.Generic;
using System.Data;
using System.IO;
using System.Linq;
using UiPath.CodedWorkflows;
using UiPath.Platform.ResourceHandling;

namespace CatalogProbeNet8
{
    // tools/ir/gen-coded.ts で IR（FormTaskTenantCheck_Full）から生成。手で直さず IR を直す
    public class FormTaskTenantCheck_Full : CodedWorkflow
    {
        [Workflow]
        public void Execute(String in_InvoiceNo)
        {
            String marker = default;
            FormTaskData task = default;
            String action = default;
            String comment = default;
            String note = default;
            FormTaskData layoutTask = default;
            String layoutAction = default;
            String layoutComment = default;
            marker = "wait-before";
            note = "note-initial";
            // GenerateInputFields のフォーム
            // CreateFormTask はCoded API が無い（Coded API なし（1.13.0 の DLL に Coded のサービスが無い。抽出器で services 0 件））ので XAML 経由（coded/_activities/CreateFormTask_26fe7e.xaml）
            var __xaml1 = RunWorkflow("coded/_activities/CreateFormTask_26fe7e.xaml", new Dictionary<string, object> { ["in_ExternalTag"] = in_InvoiceNo, ["in_FormLayout"] = "[{\"type\":\"textfield\",\"key\":\"InvoiceNo\",\"label\":\"請求書\",\"input\":true,\"disabled\":true},{\"type\":\"textfield\",\"key\":\"Comment\",\"label\":\"コメント\",\"input\":true},{\"type\":\"textfield\",\"key\":\"Note\",\"label\":\"メモ\",\"input\":true},{\"type\":\"button\",\"label\":\"Approve\",\"key\":\"approve\",\"theme\":\"primary\",\"input\":false,\"tableView\":false},{\"type\":\"button\",\"label\":\"Reject\",\"key\":\"reject\",\"theme\":\"danger\",\"input\":false,\"tableView\":false}]", ["in_Labels"] = "uipath-ir-test", ["in_TaskTitle"] = "uipath-ir-test-generated " + in_InvoiceNo, ["in_FormData_InvoiceNo"] = in_InvoiceNo, ["io_FormData_Note"] = note });
            task = (UiPath.Persistence.Activities.FormTask.FormTaskData)__xaml1["out_TaskOutput"];
            comment = (String)__xaml1["out_FormData_Comment"];
            note = (String)__xaml1["io_FormData_Note"];
            Log(message: "created1 id=" + Convert.ToString(task.Id) + " status=" + Convert.ToString(task.Status), level: UiPath.CodedWorkflows.LogLevel.Info);
            // 1つ目を待つ
            // WaitForFormTaskAndResume はCoded API が無い（Coded API なし（1.13.0 の DLL に Coded のサービスが無い。抽出器で services 0 件））ので XAML 経由（coded/_activities/WaitForFormTaskAndResume_102572.xaml）
            var __xaml2 = RunWorkflow("coded/_activities/WaitForFormTaskAndResume_102572.xaml", new Dictionary<string, object> { ["in_StatusMessage"] = "uipath-ir-test 1", ["in_TaskInput"] = task });
            action = (System.String)__xaml2["out_TaskAction"];
            task = (UiPath.Persistence.Activities.FormTask.FormTaskData)__xaml2["out_TaskOutput"];
            Log(message: "resume1 action=" + action + " comment=" + comment + " note=" + note + " marker=" + marker + " in=" + in_InvoiceNo, level: UiPath.CodedWorkflows.LogLevel.Info);
            Log(message: "resume1 task.Action=" + task.Action + " status=" + Convert.ToString(task.Status) + " data=" + Convert.ToString(task.Data), level: UiPath.CodedWorkflows.LogLevel.Info);
            // FormLayout のフォーム
            // CreateFormTask はCoded API が無い（Coded API なし（1.13.0 の DLL に Coded のサービスが無い。抽出器で services 0 件））ので XAML 経由（coded/_activities/CreateFormTask_092e01.xaml）
            var __xaml3 = RunWorkflow("coded/_activities/CreateFormTask_092e01.xaml", new Dictionary<string, object> { ["in_FormLayout"] = "[{\"type\":\"textfield\",\"key\":\"Comment\",\"label\":\"コメント\",\"input\":true},{\"type\":\"button\",\"label\":\"Approve\",\"key\":\"approve\",\"theme\":\"primary\",\"input\":false,\"tableView\":false}]", ["in_TaskTitle"] = "uipath-ir-test-layout " + in_InvoiceNo });
            layoutTask = (UiPath.Persistence.Activities.FormTask.FormTaskData)__xaml3["out_TaskOutput"];
            layoutComment = (String)__xaml3["out_FormData_Comment"];
            // 2つ目を待つ
            // WaitForFormTaskAndResume はCoded API が無い（Coded API なし（1.13.0 の DLL に Coded のサービスが無い。抽出器で services 0 件））ので XAML 経由（coded/_activities/WaitForFormTaskAndResume_047385.xaml）
            var __xaml4 = RunWorkflow("coded/_activities/WaitForFormTaskAndResume_047385.xaml", new Dictionary<string, object> { ["in_TaskInput"] = layoutTask });
            layoutAction = (System.String)__xaml4["out_TaskAction"];
            layoutTask = (UiPath.Persistence.Activities.FormTask.FormTaskData)__xaml4["out_TaskOutput"];
            Log(message: "resume2 action=" + layoutAction + " comment=" + layoutComment + " marker=" + marker + " data=" + Convert.ToString(layoutTask.Data), level: UiPath.CodedWorkflows.LogLevel.Info);
        }
    }
}
