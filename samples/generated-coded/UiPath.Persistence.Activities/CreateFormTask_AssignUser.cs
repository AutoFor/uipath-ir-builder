using System;
using System.Collections.Generic;
using System.Data;
using System.IO;
using System.Linq;
using UiPath.CodedWorkflows;
using UiPath.Platform.ResourceHandling;

namespace CatalogProbeNet8
{
    // tools/ir/gen-coded.ts で IR（CreateFormTask_AssignUser）から生成。手で直さず IR を直す
    public class CreateFormTask_AssignUser : CodedWorkflow
    {
        [Workflow]
        public void Execute()
        {
            FormTaskData task = default;
            String comment = default;
            // CreateFormTask はCoded API が無い（Coded API なし（1.13.0 の DLL に Coded のサービスが無い。抽出器で services 0 件））ので XAML 経由（coded/_xaml/CreateFormTask_AssignUser_1.xaml）
            var __xaml1 = RunWorkflow("coded/_xaml/CreateFormTask_AssignUser_1.xaml", new Dictionary<string, object> { ["task"] = task, ["comment"] = comment });
            task = (FormTaskData)__xaml1["task"];
            comment = (String)__xaml1["comment"];
        }
    }
}
