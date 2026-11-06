using System;
using System.Collections.Generic;
using System.Data;
using System.IO;
using System.Linq;
using UiPath.CodedWorkflows;
using UiPath.Platform.ResourceHandling;

namespace CatalogProbeNet8
{
    // tools/ir/gen-coded.ts で IR（CvElementExistsWithDescriptor_Min）から生成。手で直さず IR を直す
    public class CvElementExistsWithDescriptor_Min : CodedWorkflow
    {
        [Workflow]
        public void Execute()
        {
            Boolean exists = default;
            // CV スコープ
            // CVScope はCoded API が無い（Coded API なし（Computer Vision の UI 操作。Coded の uiAutomation が扱うのは Modern のターゲット（TargetAnchorableModel）だけで、CV の記述子（CvDescriptor）を受ける API が無い））ので XAML 経由（coded/_xaml/CvElementExistsWithDescriptor_Min_1.xaml）
            var __xaml1 = RunWorkflow("coded/_xaml/CvElementExistsWithDescriptor_Min_1.xaml", new Dictionary<string, object> { ["exists"] = exists });
            exists = (Boolean)__xaml1["exists"];
            Log(message: "存在: " + exists.ToString(), level: UiPath.CodedWorkflows.LogLevel.Info);
            Log(message: "done", level: UiPath.CodedWorkflows.LogLevel.Info);
        }
    }
}
