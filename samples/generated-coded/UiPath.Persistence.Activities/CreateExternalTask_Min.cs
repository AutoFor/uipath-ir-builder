using System;
using System.Collections.Generic;
using System.Data;
using System.IO;
using System.Linq;
using UiPath.CodedWorkflows;
using UiPath.Platform.ResourceHandling;

namespace CatalogProbeNet8
{
    // tools/ir/gen-coded.ts で IR（CreateExternalTask_Min）から生成。手で直さず IR を直す
    public class CreateExternalTask_Min : CodedWorkflow
    {
        [Workflow]
        public void Execute()
        {
            UiPath.Persistence.Activities.ExternalTask.ExternalTaskData task = default;
            String action = default;
            // CreateExternalTask はCoded API が無い（Coded API なし（1.13.0 の DLL に Coded のサービスが無い。抽出器で services 0 件））ので XAML 経由（coded/_activities/CreateExternalTask_8a42e3.xaml）
            var __xaml1 = RunWorkflow("coded/_activities/CreateExternalTask_8a42e3.xaml", new Dictionary<string, object> { ["in_TaskTitle"] = "外部システムで処理" });
            task = (UiPath.Persistence.Activities.ExternalTask.ExternalTaskData)__xaml1["out_TaskOutput"];
            // WaitForExternalTaskAndResume はCoded API が無い（Coded API なし（1.13.0 の DLL に Coded のサービスが無い。抽出器で services 0 件））ので XAML 経由（coded/_activities/WaitForExternalTaskAndResume.xaml）
            var __xaml2 = RunWorkflow("coded/_activities/WaitForExternalTaskAndResume.xaml", new Dictionary<string, object> { ["in_TaskInput"] = task });
            action = (System.String)__xaml2["out_TaskAction"];
            Log(message: "結果: " + action, level: UiPath.CodedWorkflows.LogLevel.Info);
        }
    }
}
