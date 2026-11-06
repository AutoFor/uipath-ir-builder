using System;
using System.Collections.Generic;
using System.Data;
using System.IO;
using System.Linq;
using UiPath.CodedWorkflows;
using UiPath.Platform.ResourceHandling;

namespace CatalogProbeNet8
{
    // tools/ir/gen-coded.ts で IR（GetXMLNodeAttributes_Min）から生成。手で直さず IR を直す
    public class GetXMLNodeAttributes_Min : CodedWorkflow
    {
        [Workflow]
        public void Execute()
        {
            System.Xml.Linq.XDocument doc = default;
            IEnumerable<System.Xml.Linq.XAttribute> attrs = default;
            // DeserializeXml は対応表が無いので XAML 経由（coded/_activities/DeserializeXml_ef444f.xaml）
            var __xaml1 = RunWorkflow("coded/_activities/DeserializeXml_ef444f.xaml", new Dictionary<string, object> { ["in_XMLString"] = "<root><item id=\"1\" kind=\"a\">A</item><item id=\"2\">B</item></root>" });
            doc = (System.Xml.Linq.XDocument)__xaml1["out_XMLDocument"];
            // GetXMLNodeAttributes は対応表が無いので XAML 経由（coded/_activities/GetXMLNodeAttributes_aa49e6.xaml）
            var __xaml2 = RunWorkflow("coded/_activities/GetXMLNodeAttributes_aa49e6.xaml", new Dictionary<string, object> { ["in_ExistingXMLNode"] = doc.Root.Elements().First() });
            attrs = (System.Collections.Generic.IEnumerable<System.Xml.Linq.XAttribute>)__xaml2["out_Attributes"];
            Log(message: "attrs=" + String.Join(",", attrs.Select(a => a.Name.LocalName + "=" + a.Value)), level: UiPath.CodedWorkflows.LogLevel.Info);
        }
    }
}
