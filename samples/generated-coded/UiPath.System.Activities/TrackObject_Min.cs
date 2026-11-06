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
            // TrackObject はCoded API が無い（Coded API なし（ISystemService に Process Tracking が無い））ので XAML 経由（coded/_activities/TrackObject.xaml）
            RunWorkflow("coded/_activities/TrackObject.xaml", new Dictionary<string, object> { ["in_ObjectId"] = "o1", ["in_ObjectType"] = "Invoice" });
            Log(message: "記録した", level: UiPath.CodedWorkflows.LogLevel.Info);
        }
    }
}
