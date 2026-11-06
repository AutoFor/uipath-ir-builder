using System;
using System.Collections.Generic;
using System.Data;
using System.IO;
using System.Linq;
using UiPath.CodedWorkflows;
using UiPath.Platform.ResourceHandling;

namespace CatalogProbeNet8
{
    // tools/ir/gen-coded.ts で IR（AssignTasks_Multi）から生成。手で直さず IR を直す
    public class AssignTasks_Multi : CodedWorkflow
    {
        [Workflow]
        public void Execute(List<TaskUserAssignment> in_Assignments)
        {
            List<TaskAssignmentResponse> failed = default;
            // AssignTasks はCoded API が無い（Coded API なし（1.13.0 の DLL に Coded のサービスが無い。抽出器で services 0 件））ので XAML 経由（coded/_xaml/AssignTasks_Multi_1.xaml）
            var __xaml1 = RunWorkflow("coded/_xaml/AssignTasks_Multi_1.xaml", new Dictionary<string, object> { ["in_Assignments"] = in_Assignments, ["failed"] = failed });
            failed = (List<TaskAssignmentResponse>)__xaml1["failed"];
        }
    }
}
