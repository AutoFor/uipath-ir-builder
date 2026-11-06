using System;
using System.Collections.Generic;
using System.Data;
using System.IO;
using System.Linq;
using UiPath.CodedWorkflows;
using UiPath.Platform.ResourceHandling;

namespace CatalogProbeNet8
{
    // tools/ir/gen-coded.ts で IR（CVScope_Full）から生成。手で直さず IR を直す
    public class CVScope_Full : CodedWorkflow
    {
        [Workflow]
        public void Execute()
        {
            // CV スコープ（全部入り）
            // CVScope はCoded API が無い（Coded API なし（Computer Vision の UI 操作。Coded の uiAutomation が扱うのは Modern のターゲット（TargetAnchorableModel）だけで、CV の記述子（CvDescriptor）を受ける API が無い））ので XAML 経由（coded/_xaml/CVScope_Full_1.xaml）
            RunWorkflow("coded/_xaml/CVScope_Full_1.xaml", null);
            Log(message: "done", level: UiPath.CodedWorkflows.LogLevel.Info);
        }
    }
}
