using System;
using System.Collections.Generic;
using System.Data;
using System.IO;
using System.Linq;
using UiPath.CodedWorkflows;
using UiPath.Platform.ResourceHandling;

namespace CatalogProbeNet8
{
    // tools/ir/gen-coded.ts で IR（TrackObject_Min）から生成。手で直さず IR を直す
    public class TrackObject_Min : CodedWorkflow
    {
        [Workflow]
        public void Execute()
        {
            // TrackObject はCoded API が無い（Coded API なし（ISystemService に Process Tracking が無い））ので XAML 経由（coded/_xaml/TrackObject_Min_1.xaml）
            RunWorkflow("coded/_xaml/TrackObject_Min_1.xaml", null);
            Log(message: "記録した", level: UiPath.CodedWorkflows.LogLevel.Info);
        }
    }
}
