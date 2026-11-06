using System;
using System.Collections.Generic;
using System.Data;
using System.IO;
using System.Linq;
using UiPath.CodedWorkflows;
using UiPath.Platform.ResourceHandling;

namespace CatalogProbeNet8
{
    // tools/ir/gen-coded.ts で IR（ExecuteXPath_Min）から生成。手で直さず IR を直す
    public class ExecuteXPath_Min : CodedWorkflow
    {
        [Workflow]
        public void Execute()
        {
            Object res = default;
            // ExecuteXPath は対応表が無いので XAML 経由（coded/_activities/ExecuteXPath_96e54d.xaml）
            var __xaml1 = RunWorkflow("coded/_activities/ExecuteXPath_96e54d.xaml", new Dictionary<string, object> { ["in_XMLString"] = "<root><item id=\"1\" kind=\"a\">A</item><item id=\"2\">B</item></root>", ["in_XPathExpression"] = "count(/root/item)" });
            res = (System.Object)__xaml1["out_Result"];
            Log(message: "count=" + res.ToString(), level: UiPath.CodedWorkflows.LogLevel.Info);
        }
    }
}
