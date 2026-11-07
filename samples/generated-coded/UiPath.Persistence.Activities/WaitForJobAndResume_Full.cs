using System;
using System.Collections.Generic;
using System.Data;
using System.IO;
using System.Linq;
using UiPath.CodedWorkflows;
using UiPath.Platform.ResourceHandling;

namespace CatalogProbeNet8
{
    // tools/ir/gen-coded.ts で IR（WaitForJobAndResume_Full）から生成。手で直さず IR を直す
    public class WaitForJobAndResume_Full : CodedWorkflow
    {
        [Workflow]
        public void Execute()
        {
            UiPath.Persistence.Activities.Job.JobData job = default;
            // StartJobAndGetReference はCoded API が無い（Coded API なし（1.13.0 の DLL に Coded のサービスが無い。抽出器で services 0 件））ので XAML 経由（coded/_activities/StartJobAndGetReference.xaml）
            var __xaml1 = RunWorkflow("coded/_activities/StartJobAndGetReference.xaml", new Dictionary<string, object> { ["in_ProcessName"] = "ChildProcess" });
            job = (UiPath.Persistence.Activities.Job.JobData)__xaml1["out_JobOutput"];
            // ジョブを待つ
            // WaitForJobAndResume はCoded API が無い（Coded API なし（1.13.0 の DLL に Coded のサービスが無い。抽出器で services 0 件））ので XAML 経由（coded/_activities/WaitForJobAndResume_2320a2.xaml）
            var __xaml2 = RunWorkflow("coded/_activities/WaitForJobAndResume_2320a2.xaml", new Dictionary<string, object> { ["in_ContinueOnError"] = false, ["in_JobInput"] = job, ["in_StatusMessage"] = "ジョブ待ち", ["in_TimeoutMs"] = 30000, ["io_WaitItemDataObject"] = job });
            job = (UiPath.Persistence.Activities.Job.JobData)__xaml2["out_JobOutput"];
            job = (UiPath.Persistence.Activities.Job.JobData)__xaml2["io_WaitItemDataObject"];
            Log(message: "再開した", level: UiPath.CodedWorkflows.LogLevel.Info);
        }
    }
}
