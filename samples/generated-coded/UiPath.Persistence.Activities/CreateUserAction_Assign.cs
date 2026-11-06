using System;
using System.Collections.Generic;
using System.Data;
using System.IO;
using System.Linq;
using UiPath.CodedWorkflows;
using UiPath.Platform.ResourceHandling;

namespace CatalogProbeNet8
{
    // tools/ir/gen-coded.ts で IR（CreateUserAction_Assign）から生成。手で直さず IR を直す
    public class CreateUserAction_Assign : CodedWorkflow
    {
        [Workflow]
        public void Execute()
        {
            UserActionData task1 = default;
            UserActionData task2 = default;
            // CreateUserAction はCoded API が無い（Coded API なし（1.13.0 の DLL に Coded のサービスが無い。抽出器で services 0 件））ので XAML 経由（coded/_xaml/CreateUserAction_Assign_1.xaml）
            var __xaml1 = RunWorkflow("coded/_xaml/CreateUserAction_Assign_1.xaml", new Dictionary<string, object> { ["task1"] = task1 });
            task1 = (UserActionData)__xaml1["task1"];
            // CreateUserAction はCoded API が無い（Coded API なし（1.13.0 の DLL に Coded のサービスが無い。抽出器で services 0 件））ので XAML 経由（coded/_xaml/CreateUserAction_Assign_2.xaml）
            var __xaml2 = RunWorkflow("coded/_xaml/CreateUserAction_Assign_2.xaml", new Dictionary<string, object> { ["task2"] = task2 });
            task2 = (UserActionData)__xaml2["task2"];
        }
    }
}
