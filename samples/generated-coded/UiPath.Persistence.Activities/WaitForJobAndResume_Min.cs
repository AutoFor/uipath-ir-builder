using System;
using System.Collections.Generic;
using System.Data;
using System.IO;
using System.Linq;
using UiPath.CodedWorkflows;
using UiPath.Platform.ResourceHandling;

namespace CatalogProbeNet8
{
    // tools/ir/gen-coded.ts で IR（WaitForJobAndResume_Min）から生成。手で直さず IR を直す
    public class WaitForJobAndResume_Min : CodedWorkflow
    {
        [Workflow]
        public void Execute()
        {
            JobData job = default;
            // StartJobAndGetReference はCoded API が無い（Coded API なし（1.13.0 の DLL に Coded のサービスが無い。抽出器で services 0 件））ので XAML 経由（coded/_xaml/WaitForJobAndResume_Min_1.xaml）
            var __xaml1 = RunWorkflow("coded/_xaml/WaitForJobAndResume_Min_1.xaml", new Dictionary<string, object> { ["job"] = job });
            job = (JobData)__xaml1["job"];
            // WaitForJobAndResume はCoded API が無い（Coded API なし（1.13.0 の DLL に Coded のサービスが無い。抽出器で services 0 件））ので XAML 経由（coded/_xaml/WaitForJobAndResume_Min_2.xaml）
            RunWorkflow("coded/_xaml/WaitForJobAndResume_Min_2.xaml", new Dictionary<string, object> { ["job"] = job });
            Log(message: "再開した", level: UiPath.CodedWorkflows.LogLevel.Info);
        }
    }
}
