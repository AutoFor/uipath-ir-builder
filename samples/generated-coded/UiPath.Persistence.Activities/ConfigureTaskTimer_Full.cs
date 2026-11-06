using System;
using System.Collections.Generic;
using System.Data;
using System.IO;
using System.Linq;
using UiPath.CodedWorkflows;
using UiPath.Platform.ResourceHandling;

namespace CatalogProbeNet8
{
    // tools/ir/gen-coded.ts で IR（ConfigureTaskTimer_Full）から生成。手で直さず IR を直す
    public class ConfigureTaskTimer_Full : CodedWorkflow
    {
        [Workflow]
        public void Execute(Int64 in_TaskId)
        {
            // タイマーを設定する
            // ConfigureTaskTimer はCoded API が無い（Coded API なし（1.13.0 の DLL に Coded のサービスが無い。抽出器で services 0 件））ので XAML 経由（coded/_activities/ConfigureTaskTimer_e0f478.xaml）
            RunWorkflow("coded/_activities/ConfigureTaskTimer_e0f478.xaml", new Dictionary<string, object> { ["in_AutoCompleteOutcome"] = "Approve", ["in_ContinueOnError"] = false, ["in_FolderPath"] = "Shared", ["in_ReassignGroup"] = "Reviewers", ["in_ReassignUser"] = "user@example.com", ["in_TaskId"] = in_TaskId, ["in_TimeoutMs"] = 30000, ["in_TimerDuration"] = TimeSpan.FromHours(4) });
        }
    }
}
