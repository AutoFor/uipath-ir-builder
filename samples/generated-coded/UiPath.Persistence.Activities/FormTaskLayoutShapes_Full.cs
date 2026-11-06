using System;
using System.Collections.Generic;
using System.Data;
using System.IO;
using System.Linq;
using UiPath.CodedWorkflows;
using UiPath.Platform.ResourceHandling;

namespace CatalogProbeNet8
{
    // tools/ir/gen-coded.ts で IR（FormTaskLayoutShapes_Full）から生成。手で直さず IR を直す
    public class FormTaskLayoutShapes_Full : CodedWorkflow
    {
        [Workflow]
        public void Execute(String in_InvoiceNo)
        {
            FormTaskData task = default;
            String action = default;
            String comment = default;
            // 配列の形
            // CreateFormTask はCoded API が無い（Coded API なし（1.13.0 の DLL に Coded のサービスが無い。抽出器で services 0 件））ので XAML 経由（coded/_xaml/FormTaskLayoutShapes_Full_1.xaml）
            var __xaml1 = RunWorkflow("coded/_xaml/FormTaskLayoutShapes_Full_1.xaml", new Dictionary<string, object> { ["in_InvoiceNo"] = in_InvoiceNo, ["task"] = task, ["comment"] = comment });
            task = (FormTaskData)__xaml1["task"];
            comment = (String)__xaml1["comment"];
            Log(message: "created array=" + Convert.ToString(task.Id), level: UiPath.CodedWorkflows.LogLevel.Info);
            // 配列の形のタスクを待つ
            // WaitForFormTaskAndResume はCoded API が無い（Coded API なし（1.13.0 の DLL に Coded のサービスが無い。抽出器で services 0 件））ので XAML 経由（coded/_xaml/FormTaskLayoutShapes_Full_2.xaml）
            var __xaml2 = RunWorkflow("coded/_xaml/FormTaskLayoutShapes_Full_2.xaml", new Dictionary<string, object> { ["task"] = task, ["action"] = action });
            task = (FormTaskData)__xaml2["task"];
            action = (String)__xaml2["action"];
            Log(message: "resume action=" + action + " comment=" + comment, level: UiPath.CodedWorkflows.LogLevel.Info);
        }
    }
}
