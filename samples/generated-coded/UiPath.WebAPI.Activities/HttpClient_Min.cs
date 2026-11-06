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
            // HttpClient は対応表が無いので XAML 経由（coded/_xaml/HttpClient_Min_1.xaml）
            var __xaml1 = RunWorkflow("coded/_xaml/HttpClient_Min_1.xaml", new Dictionary<string, object> { ["body"] = body, ["code"] = code });
            body = (String)__xaml1["body"];
            code = (Int32)__xaml1["code"];
            Log(message: "status=" + code.ToString(), level: UiPath.CodedWorkflows.LogLevel.Info);
        }
    }
}
