using System;
using System.Collections.Generic;
using System.Data;
using System.IO;
using System.Linq;
using UiPath.CodedWorkflows;
using UiPath.Platform.ResourceHandling;

namespace CatalogProbeNet8
{
    // tools/ir/gen-coded.ts で IR（GetXMLNodes_Min）から生成。手で直さず IR を直す
    public class GetXMLNodes_Min : CodedWorkflow
    {
        [Workflow]
        public void Execute()
        {
            IEnumerable<System.Xml.Linq.XNode> nodes = default;
            // GetXMLNodes は対応表が無いので XAML 経由（coded/_activities/GetXMLNodes_4c2987.xaml）
            var __xaml1 = RunWorkflow("coded/_activities/GetXMLNodes_4c2987.xaml", new Dictionary<string, object> { ["in_XMLString"] = "<root><item id=\"1\" kind=\"a\">A</item><item id=\"2\">B</item></root>" });
            nodes = (System.Collections.Generic.IEnumerable<System.Xml.Linq.XNode>)__xaml1["out_XMLNodes"];
            Log(message: "nodes=" + nodes.Count().ToString(), level: UiPath.CodedWorkflows.LogLevel.Info);
        }
    }
}
