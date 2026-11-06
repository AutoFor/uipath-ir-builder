using System;
using System.Collections.Generic;
using System.Data;
using System.IO;
using System.Linq;
using UiPath.CodedWorkflows;
using UiPath.Platform.ResourceHandling;

namespace CatalogProbeNet8
{
    // tools/ir/gen-coded.ts で IR（EvaluateBusinessRule_Full）から生成。手で直さず IR を直す
    public class EvaluateBusinessRule_Full : CodedWorkflow
    {
        [Workflow]
        public void Execute()
        {
            Object o = default;
            // ルールを評価
            // EvaluateBusinessRule はCoded API が無い（Coded API なし（ビジネスルールの評価 API が ISystemService に無い））ので XAML 経由（coded/_activities/EvaluateBusinessRule_95ff73.xaml）
            var __xaml1 = RunWorkflow("coded/_activities/EvaluateBusinessRule_95ff73.xaml", new Dictionary<string, object> { ["in_BusinessRule"] = "IrRule", ["in_ContinueOnError"] = true, ["in_FolderPath"] = "Shared", ["in_TimeoutMS"] = 10000, ["in_Arguments_in_Name"] = "太郎" });
            o = (Object)__xaml1["out_Output"];
            Log(message: "評価した", level: UiPath.CodedWorkflows.LogLevel.Info);
        }
    }
}
