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
            // DeserializeXml は対応表が無いので XAML 経由（coded/_xaml/DeserializeXml_Min_1.xaml）
            var __xaml1 = RunWorkflow("coded/_xaml/DeserializeXml_Min_1.xaml", new Dictionary<string, object> { ["doc"] = doc });
            doc = (System.Xml.Linq.XDocument)__xaml1["doc"];
            Log(message: "root=" + doc.Root.Name.LocalName + ", items=" + doc.Root.Elements().Count().ToString(), level: UiPath.CodedWorkflows.LogLevel.Info);
        }
    }
}
