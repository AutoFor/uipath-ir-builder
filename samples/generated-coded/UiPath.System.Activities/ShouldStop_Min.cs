using System;
using System.Collections.Generic;
using System.Data;
using System.IO;
using System.Linq;
using UiPath.CodedWorkflows;
using UiPath.Platform.ResourceHandling;

namespace CatalogProbeNet8
{
    // tools/ir/gen-coded.ts で IR（ShouldStop_Min）から生成。手で直さず IR を直す
    public class ShouldStop_Min : CodedWorkflow
    {
        [Workflow]
        public void Execute()
        {
            Boolean isStopped = default;
            // ShouldStop はCoded API が無い（Coded API なし（ジョブの停止要求を調べる API が ISystemService / CodedWorkflow に無い））ので XAML 経由（coded/_activities/ShouldStop_5d5c19.xaml）
            var __xaml1 = RunWorkflow("coded/_activities/ShouldStop_5d5c19.xaml", null);
            isStopped = (System.Boolean)__xaml1["out_Result"];
            Log(message: "isStopped=" + isStopped.ToString(), level: UiPath.CodedWorkflows.LogLevel.Info);
        }
    }
}
