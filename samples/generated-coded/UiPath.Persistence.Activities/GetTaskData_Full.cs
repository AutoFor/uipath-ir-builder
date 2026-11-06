using System;
using System.Collections.Generic;
using System.Data;
using System.IO;
using System.Linq;
using UiPath.CodedWorkflows;
using UiPath.Platform.ResourceHandling;

namespace CatalogProbeNet8
{
    // tools/ir/gen-coded.ts で IR（GetTaskData_Full）から生成。手で直さず IR を直す
    public class GetTaskData_Full : CodedWorkflow
    {
        [Workflow]
        public void Execute(Int64 in_TaskId)
        {
            TaskData data = default;
            // タスクを読む
            // GetTaskData はCoded API が無い（Coded API なし（1.13.0 の DLL に Coded のサービスが無い。抽出器で services 0 件））ので XAML 経由（coded/_xaml/GetTaskData_Full_1.xaml）
            var __xaml1 = RunWorkflow("coded/_xaml/GetTaskData_Full_1.xaml", new Dictionary<string, object> { ["in_TaskId"] = in_TaskId, ["data"] = data });
            data = (TaskData)__xaml1["data"];
            Log(message: "タスク: " + data.Id.ToString(), level: UiPath.CodedWorkflows.LogLevel.Info);
        }
    }
}
