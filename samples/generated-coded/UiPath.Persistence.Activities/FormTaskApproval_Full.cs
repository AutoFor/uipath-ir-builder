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
            FormTaskData task = default;
            String action = default;
            String comment = default;
            // 承認タスクを作る
            // CreateFormTask はCoded API が無い（Coded API なし（1.13.0 の DLL に Coded のサービスが無い。抽出器で services 0 件））ので XAML 経由（coded/_xaml/FormTaskApproval_Full_1.xaml）
            var __xaml1 = RunWorkflow("coded/_xaml/FormTaskApproval_Full_1.xaml", new Dictionary<string, object> { ["in_InvoiceNo"] = in_InvoiceNo, ["task"] = task, ["comment"] = comment });
            task = (FormTaskData)__xaml1["task"];
            comment = (String)__xaml1["comment"];
            // 人の判断を待つ
            // WaitForFormTaskAndResume はCoded API が無い（Coded API なし（1.13.0 の DLL に Coded のサービスが無い。抽出器で services 0 件））ので XAML 経由（coded/_xaml/FormTaskApproval_Full_2.xaml）
            var __xaml2 = RunWorkflow("coded/_xaml/FormTaskApproval_Full_2.xaml", new Dictionary<string, object> { ["task"] = task, ["action"] = action });
            task = (FormTaskData)__xaml2["task"];
            action = (String)__xaml2["action"];
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
