using System;
using System.Collections.Generic;
using System.Data;
using System.IO;
using System.Linq;
using UiPath.CodedWorkflows;
using UiPath.Platform.ResourceHandling;

namespace CatalogProbeNet8
{
    // tools/ir/gen-coded.ts で IR（WaitForUserActionAndResume_Min）から生成。手で直さず IR を直す
    public class WaitForUserActionAndResume_Min : CodedWorkflow
    {
        [Workflow]
        public void Execute()
        {
            UserActionData task = default;
            String action = default;
            // CreateUserAction はCoded API が無い（Coded API なし（1.13.0 の DLL に Coded のサービスが無い。抽出器で services 0 件））ので XAML 経由（coded/_xaml/WaitForUserActionAndResume_Min_1.xaml）
            var __xaml1 = RunWorkflow("coded/_xaml/WaitForUserActionAndResume_Min_1.xaml", new Dictionary<string, object> { ["task"] = task });
            task = (UserActionData)__xaml1["task"];
            // WaitForUserActionAndResume はCoded API が無い（Coded API なし（1.13.0 の DLL に Coded のサービスが無い。抽出器で services 0 件））ので XAML 経由（coded/_xaml/WaitForUserActionAndResume_Min_2.xaml）
            var __xaml2 = RunWorkflow("coded/_xaml/WaitForUserActionAndResume_Min_2.xaml", new Dictionary<string, object> { ["task"] = task, ["action"] = action });
            action = (String)__xaml2["action"];
            Log(message: "結果: " + action, level: UiPath.CodedWorkflows.LogLevel.Info);
        }
    }
}
