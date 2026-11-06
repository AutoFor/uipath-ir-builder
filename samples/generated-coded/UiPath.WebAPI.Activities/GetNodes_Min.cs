using System;
using System.Collections.Generic;
using System.Data;
using System.IO;
using System.Linq;
using UiPath.CodedWorkflows;
using UiPath.Platform.ResourceHandling;

namespace CatalogProbeNet8
{
    // tools/ir/gen-coded.ts で IR（GetNodes_Min）から生成。手で直さず IR を直す
    public class GetNodes_Min : CodedWorkflow
    {
        [Workflow]
        public void Execute()
        {
            IEnumerable<System.Xml.Linq.XNode> nodes = default;
            // GetNodes は対応表が無いので XAML 経由（coded/_xaml/GetNodes_Min_1.xaml）
            var __xaml1 = RunWorkflow("coded/_xaml/GetNodes_Min_1.xaml", new Dictionary<string, object> { ["nodes"] = nodes });
            nodes = (IEnumerable<System.Xml.Linq.XNode>)__xaml1["nodes"];
            Log(message: "nodes=" + nodes.Count().ToString(), level: UiPath.CodedWorkflows.LogLevel.Info);
        }
    }
}
