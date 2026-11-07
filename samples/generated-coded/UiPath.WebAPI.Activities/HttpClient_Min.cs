using System;
using System.Collections.Generic;
using System.Data;
using System.IO;
using System.Linq;
using UiPath.CodedWorkflows;
using UiPath.Platform.ResourceHandling;

namespace CatalogProbeNet8
{
    // tools/ir/gen-coded.ts で IR（HttpClient_Min）から生成。手で直さず IR を直す
    public class HttpClient_Min : CodedWorkflow
    {
        [Workflow]
        public void Execute()
        {
            String body = default;
            Int32 code = default;
            // HttpClient は対応表が無いので XAML 経由（coded/_activities/HttpClient_3fbf1d.xaml）
            var __xaml1 = RunWorkflow("coded/_activities/HttpClient_3fbf1d.xaml", new Dictionary<string, object> { ["in_EndPoint"] = "https://example.com/" });
            body = (System.String)__xaml1["out_Result"];
            code = (System.Int32)__xaml1["out_StatusCode"];
            Log(message: "status=" + code.ToString(), level: UiPath.CodedWorkflows.LogLevel.Info);
        }
    }
}
