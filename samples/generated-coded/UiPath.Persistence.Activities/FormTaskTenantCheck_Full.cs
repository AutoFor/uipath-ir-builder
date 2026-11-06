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
            // CreateFormTask はCoded API が無い（Coded API なし（1.13.0 の DLL に Coded のサービスが無い。抽出器で services 0 件））ので XAML 経由（coded/_xaml/FormTaskTenantCheck_Full_1.xaml）
            var __xaml1 = RunWorkflow("coded/_xaml/FormTaskTenantCheck_Full_1.xaml", new Dictionary<string, object> { ["in_InvoiceNo"] = in_InvoiceNo, ["task"] = task, ["comment"] = comment, ["note"] = note });
            task = (FormTaskData)__xaml1["task"];
            comment = (String)__xaml1["comment"];
            note = (String)__xaml1["note"];
            Log(message: "created1 id=" + Convert.ToString(task.Id) + " status=" + Convert.ToString(task.Status), level: UiPath.CodedWorkflows.LogLevel.Info);
            // 1つ目を待つ
            // WaitForFormTaskAndResume はCoded API が無い（Coded API なし（1.13.0 の DLL に Coded のサービスが無い。抽出器で services 0 件））ので XAML 経由（coded/_xaml/FormTaskTenantCheck_Full_2.xaml）
            var __xaml2 = RunWorkflow("coded/_xaml/FormTaskTenantCheck_Full_2.xaml", new Dictionary<string, object> { ["task"] = task, ["action"] = action });
            task = (FormTaskData)__xaml2["task"];
            action = (String)__xaml2["action"];
            Log(message: "resume1 action=" + action + " comment=" + comment + " note=" + note + " marker=" + marker + " in=" + in_InvoiceNo, level: UiPath.CodedWorkflows.LogLevel.Info);
            Log(message: "resume1 task.Action=" + task.Action + " status=" + Convert.ToString(task.Status) + " data=" + Convert.ToString(task.Data), level: UiPath.CodedWorkflows.LogLevel.Info);
            // FormLayout のフォーム
            // CreateFormTask はCoded API が無い（Coded API なし（1.13.0 の DLL に Coded のサービスが無い。抽出器で services 0 件））ので XAML 経由（coded/_xaml/FormTaskTenantCheck_Full_3.xaml）
            var __xaml3 = RunWorkflow("coded/_xaml/FormTaskTenantCheck_Full_3.xaml", new Dictionary<string, object> { ["in_InvoiceNo"] = in_InvoiceNo, ["layoutTask"] = layoutTask, ["layoutComment"] = layoutComment });
            layoutTask = (FormTaskData)__xaml3["layoutTask"];
            layoutComment = (String)__xaml3["layoutComment"];
            // 2つ目を待つ
            // WaitForFormTaskAndResume はCoded API が無い（Coded API なし（1.13.0 の DLL に Coded のサービスが無い。抽出器で services 0 件））ので XAML 経由（coded/_xaml/FormTaskTenantCheck_Full_4.xaml）
            var __xaml4 = RunWorkflow("coded/_xaml/FormTaskTenantCheck_Full_4.xaml", new Dictionary<string, object> { ["layoutTask"] = layoutTask, ["layoutAction"] = layoutAction });
            layoutTask = (FormTaskData)__xaml4["layoutTask"];
            layoutAction = (String)__xaml4["layoutAction"];
            Log(message: "resume2 action=" + layoutAction + " comment=" + layoutComment + " marker=" + marker + " data=" + Convert.ToString(layoutTask.Data), level: UiPath.CodedWorkflows.LogLevel.Info);
        }
    }
}
