using System;
using System.Collections.Generic;
using System.Data;
using System.IO;
using System.Linq;
using UiPath.CodedWorkflows;
using UiPath.Platform.ResourceHandling;

namespace CatalogProbeNet8
{
    // tools/ir/gen-coded.ts で IR（CvExtractDataTableWithDescriptor_Full）から生成。手で直さず IR を直す
    public class CvExtractDataTableWithDescriptor_Full : CodedWorkflow
    {
        [Workflow]
        public void Execute()
        {
            DataTable dt = default;
            // CV スコープ
            // CVScope はCoded API が無い（Coded API なし（Computer Vision の UI 操作。Coded の uiAutomation が扱うのは Modern のターゲット（TargetAnchorableModel）だけで、CV の記述子（CvDescriptor）を受ける API が無い））ので XAML 経由（coded/_xaml/CvExtractDataTableWithDescriptor_Full_1.xaml）
            var __xaml1 = RunWorkflow("coded/_xaml/CvExtractDataTableWithDescriptor_Full_1.xaml", new Dictionary<string, object> { ["dt"] = dt });
            dt = (DataTable)__xaml1["dt"];
            Log(message: "行数: " + dt.Rows.Count.ToString(), level: UiPath.CodedWorkflows.LogLevel.Info);
            Log(message: "done", level: UiPath.CodedWorkflows.LogLevel.Info);
        }
    }
}
