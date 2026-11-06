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
            // CreateExternalTask はCoded API が無い（Coded API なし（1.13.0 の DLL に Coded のサービスが無い。抽出器で services 0 件））ので XAML 経由（coded/_xaml/WaitForExternalTaskAndResume_Full_1.xaml）
            var __xaml1 = RunWorkflow("coded/_xaml/WaitForExternalTaskAndResume_Full_1.xaml", new Dictionary<string, object> { ["task"] = task });
            task = (ExternalTaskData)__xaml1["task"];
            // 外部の処理を待つ
            // WaitForExternalTaskAndResume はCoded API が無い（Coded API なし（1.13.0 の DLL に Coded のサービスが無い。抽出器で services 0 件））ので XAML 経由（coded/_xaml/WaitForExternalTaskAndResume_Full_2.xaml）
            var __xaml2 = RunWorkflow("coded/_xaml/WaitForExternalTaskAndResume_Full_2.xaml", new Dictionary<string, object> { ["task"] = task, ["action"] = action });
            task = (ExternalTaskData)__xaml2["task"];
            action = (String)__xaml2["action"];
        }
    }
}
