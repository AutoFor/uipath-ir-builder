using System;
using System.Collections.Generic;
using System.Data;
using System.IO;
using System.Linq;
using UiPath.CodedWorkflows;
using UiPath.Platform.ResourceHandling;

namespace CatalogProbeNet8
{
    // tools/ir/gen-coded.ts で IR（TrackObject_Full）から生成。手で直さず IR を直す
    public class TrackObject_Full : CodedWorkflow
    {
        [Workflow]
        public void Execute()
        {
            // オブジェクト追跡
            // TrackObject はCoded API が無い（Coded API なし（ISystemService に Process Tracking が無い））ので XAML 経由（coded/_activities/TrackObject_2512d0.xaml）
            RunWorkflow("coded/_activities/TrackObject_2512d0.xaml", new Dictionary<string, object> { ["in_ObjectId"] = "o1", ["in_ObjectProperties"] = new Dictionary<String, String>() { { "status", "open" } }, ["in_ObjectPropertiesV2"] = new Dictionary<String, Object>() { { "amount", 100 } }, ["in_ObjectType"] = "Invoice" });
            Log(message: "記録した", level: UiPath.CodedWorkflows.LogLevel.Info);
        }
    }
}
