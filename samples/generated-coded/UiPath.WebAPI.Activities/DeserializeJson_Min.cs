using System;
using System.Collections.Generic;
using System.Data;
using System.IO;
using System.Linq;
using UiPath.CodedWorkflows;
using UiPath.Platform.ResourceHandling;

namespace CatalogProbeNet8
{
    // tools/ir/gen-coded.ts で IR（DeserializeJson_Min）から生成。手で直さず IR を直す
    public class DeserializeJson_Min : CodedWorkflow
    {
        [Workflow]
        public void Execute()
        {
            Newtonsoft.Json.Linq.JObject obj = default;
            // DeserializeJson は対応表が無いので XAML 経由（coded/_xaml/DeserializeJson_Min_1.xaml）
            var __xaml1 = RunWorkflow("coded/_xaml/DeserializeJson_Min_1.xaml", new Dictionary<string, object> { ["obj"] = obj });
            obj = (Newtonsoft.Json.Linq.JObject)__xaml1["obj"];
            Log(message: "name=" + obj["name"].ToString() + ", age=" + obj["age"].ToString(), level: UiPath.CodedWorkflows.LogLevel.Info);
        }
    }
}
