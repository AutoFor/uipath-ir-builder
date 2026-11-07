using System;
using System.Collections.Generic;
using System.Data;
using System.IO;
using System.Linq;
using UiPath.CodedWorkflows;
using UiPath.Platform.ResourceHandling;

namespace CatalogProbeNet8
{
    // tools/ir/gen-coded.ts で IR（StartJobAndGetReference_Min）から生成。手で直さず IR を直す
    public class StartJobAndGetReference_Min : CodedWorkflow
    {
        [Workflow]
        public void Execute()
        {
            UiPath.Persistence.Activities.Job.JobData job = default;
            // StartJobAndGetReference はCoded API が無い（Coded API なし（1.13.0 の DLL に Coded のサービスが無い。抽出器で services 0 件））ので XAML 経由（coded/_activities/StartJobAndGetReference.xaml）
            var __xaml1 = RunWorkflow("coded/_activities/StartJobAndGetReference.xaml", new Dictionary<string, object> { ["in_ProcessName"] = "ChildProcess" });
            job = (UiPath.Persistence.Activities.Job.JobData)__xaml1["out_JobOutput"];
        }
    }
}
