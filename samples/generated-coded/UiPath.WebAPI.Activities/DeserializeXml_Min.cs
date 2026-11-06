using System;
using System.Collections.Generic;
using System.Data;
using System.IO;
using System.Linq;
using UiPath.CodedWorkflows;
using UiPath.Platform.ResourceHandling;

namespace CatalogProbeNet8
{
    // tools/ir/gen-coded.ts で IR（DeserializeXml_Min）から生成。手で直さず IR を直す
    public class DeserializeXml_Min : CodedWorkflow
    {
        [Workflow]
        public void Execute()
        {
            System.Xml.Linq.XDocument doc = default;
            // DeserializeXml は対応表が無いので XAML 経由（coded/_activities/DeserializeXml_ef444f.xaml）
            var __xaml1 = RunWorkflow("coded/_activities/DeserializeXml_ef444f.xaml", new Dictionary<string, object> { ["in_XMLString"] = "<root><item id=\"1\" kind=\"a\">A</item><item id=\"2\">B</item></root>" });
            doc = (System.Xml.Linq.XDocument)__xaml1["out_XMLDocument"];
            Log(message: "root=" + doc.Root.Name.LocalName + ", items=" + doc.Root.Elements().Count().ToString(), level: UiPath.CodedWorkflows.LogLevel.Info);
        }
    }
}
