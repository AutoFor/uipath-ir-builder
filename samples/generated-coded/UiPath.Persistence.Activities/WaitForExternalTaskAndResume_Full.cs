using System;
using System.Collections.Generic;
using System.Data;
using System.IO;
using System.Linq;
using UiPath.CodedWorkflows;
using UiPath.Platform.ResourceHandling;

namespace CatalogProbeNet8
{
    // tools/ir/gen-coded.ts で IR（WaitForExternalTaskAndResume_Full）から生成。手で直さず IR を直す
    public class WaitForExternalTaskAndResume_Full : CodedWorkflow
    {
        [Workflow]
        public void Execute()
        {
            ExternalTaskData task = default;
            String action = default;
            // CreateExternalTask はCoded API が無い（Coded API なし（1.13.0 の DLL に Coded のサービスが無い。抽出器で services 0 件））ので XAML 経由（coded/_activities/CreateExternalTask_c1e53b.xaml）
            var __xaml1 = RunWorkflow("coded/_activities/CreateExternalTask_c1e53b.xaml", new Dictionary<string, object> { ["in_TaskTitle"] = "確認" });
            task = (UiPath.Persistence.Activities.ExternalTask.ExternalTaskData)__xaml1["out_TaskOutput"];
            // 外部の処理を待つ
            // WaitForExternalTaskAndResume はCoded API が無い（Coded API なし（1.13.0 の DLL に Coded のサービスが無い。抽出器で services 0 件））ので XAML 経由（coded/_activities/WaitForExternalTaskAndResume_92277f.xaml）
            var __xaml2 = RunWorkflow("coded/_activities/WaitForExternalTaskAndResume_92277f.xaml", new Dictionary<string, object> { ["in_ContinueOnError"] = false, ["in_StatusMessage"] = "処理待ち", ["in_TaskInput"] = task, ["in_TimeoutMs"] = 30000, ["io_WaitItemDataObject"] = task });
            action = (System.String)__xaml2["out_TaskAction"];
            task = (UiPath.Persistence.Activities.ExternalTask.ExternalTaskData)__xaml2["out_TaskOutput"];
            task = (UiPath.Persistence.Activities.ExternalTask.ExternalTaskData)__xaml2["io_WaitItemDataObject"];
        }
    }
}
