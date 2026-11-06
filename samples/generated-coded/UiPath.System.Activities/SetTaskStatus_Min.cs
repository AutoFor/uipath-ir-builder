using System;
using System.Collections.Generic;
using System.Data;
using System.IO;
using System.Linq;
using UiPath.CodedWorkflows;
using UiPath.Platform.ResourceHandling;

namespace CatalogProbeNet8
{
    // tools/ir/gen-coded.ts で IR（SetTaskStatus_Min）から生成。手で直さず IR を直す
    public class SetTaskStatus_Min : CodedWorkflow
    {
        [Workflow]
        public void Execute()
        {
            // トラッキングの範囲
            // ProcessTrackingScope はCoded API が無い（Coded API なし（ISystemService に Process Tracking Scope が無い））ので XAML 経由（coded/_xaml/SetTaskStatus_Min_1.xaml）
            RunWorkflow("coded/_xaml/SetTaskStatus_Min_1.xaml", null);
        }
    }
}
