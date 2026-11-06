using System;
using System.Collections.Generic;
using System.Data;
using System.IO;
using System.Linq;
using UiPath.CodedWorkflows;
using UiPath.Platform.ResourceHandling;

namespace CatalogProbeNet8
{
    // tools/ir/gen-coded.ts で IR（ShouldStop_Full）から生成。手で直さず IR を直す
    public class ShouldStop_Full : CodedWorkflow
    {
        [Workflow]
        public void Execute()
        {
            Boolean isStopped = default;
            // 停止要求を調べる
            // ShouldStop はCoded API が無い（Coded API なし（ジョブの停止要求を調べる API が ISystemService / CodedWorkflow に無い））ので XAML 経由（coded/_xaml/ShouldStop_Full_1.xaml）
            var __xaml1 = RunWorkflow("coded/_xaml/ShouldStop_Full_1.xaml", new Dictionary<string, object> { ["isStopped"] = isStopped });
            isStopped = (Boolean)__xaml1["isStopped"];
            if (isStopped)
            {
                Log(message: "停止要求あり", level: UiPath.CodedWorkflows.LogLevel.Info);
            }
            else
            {
                Log(message: "停止要求なし", level: UiPath.CodedWorkflows.LogLevel.Info);
            }
        }
    }
}
