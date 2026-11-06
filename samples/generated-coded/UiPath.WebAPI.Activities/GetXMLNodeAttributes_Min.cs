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
            // DeserializeXml は対応表が無いので XAML 経由（coded/_xaml/GetXMLNodeAttributes_Min_1.xaml）
            var __xaml1 = RunWorkflow("coded/_xaml/GetXMLNodeAttributes_Min_1.xaml", new Dictionary<string, object> { ["doc"] = doc });
            doc = (System.Xml.Linq.XDocument)__xaml1["doc"];
            // GetXMLNodeAttributes は対応表が無いので XAML 経由（coded/_xaml/GetXMLNodeAttributes_Min_2.xaml）
            var __xaml2 = RunWorkflow("coded/_xaml/GetXMLNodeAttributes_Min_2.xaml", new Dictionary<string, object> { ["doc"] = doc, ["attrs"] = attrs });
            attrs = (IEnumerable<System.Xml.Linq.XAttribute>)__xaml2["attrs"];
            Log(message: "attrs=" + String.Join(",", attrs.Select(a => a.Name.LocalName + "=" + a.Value)), level: UiPath.CodedWorkflows.LogLevel.Info);
        }
    }
}
