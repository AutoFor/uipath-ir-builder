using System;
using System.Collections.Generic;
using System.Data;
using System.IO;
using System.Linq;
using UiPath.CodedWorkflows;
using UiPath.Platform.ResourceHandling;

namespace CatalogProbeNet8
{
    // tools/ir/gen-coded.ts で IR（CreateFormTask_AssignDistribute）から生成。手で直さず IR を直す
    public class CreateFormTask_AssignDistribute : CodedWorkflow
    {
        [Workflow]
        public void Execute()
        {
            FormTaskData task1 = default;
            String comment1 = default;
            FormTaskData task2 = default;
            String comment2 = default;
            // CreateFormTask はCoded API が無い（Coded API なし（1.13.0 の DLL に Coded のサービスが無い。抽出器で services 0 件））ので XAML 経由（coded/_xaml/CreateFormTask_AssignDistribute_1.xaml）
            var __xaml1 = RunWorkflow("coded/_xaml/CreateFormTask_AssignDistribute_1.xaml", new Dictionary<string, object> { ["task1"] = task1, ["comment1"] = comment1 });
            task1 = (FormTaskData)__xaml1["task1"];
            comment1 = (String)__xaml1["comment1"];
            // CreateFormTask はCoded API が無い（Coded API なし（1.13.0 の DLL に Coded のサービスが無い。抽出器で services 0 件））ので XAML 経由（coded/_xaml/CreateFormTask_AssignDistribute_2.xaml）
            var __xaml2 = RunWorkflow("coded/_xaml/CreateFormTask_AssignDistribute_2.xaml", new Dictionary<string, object> { ["task2"] = task2, ["comment2"] = comment2 });
            task2 = (FormTaskData)__xaml2["task2"];
            comment2 = (String)__xaml2["comment2"];
        }
    }
}
