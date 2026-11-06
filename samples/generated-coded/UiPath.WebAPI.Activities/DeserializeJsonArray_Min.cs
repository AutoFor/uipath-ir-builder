using System;
using System.Collections.Generic;
using System.Data;
using System.IO;
using System.Linq;
using UiPath.CodedWorkflows;
using UiPath.Platform.ResourceHandling;

namespace CatalogProbeNet8
{
    // tools/ir/gen-coded.ts で IR（DeserializeJsonArray_Min）から生成。手で直さず IR を直す
    public class DeserializeJsonArray_Min : CodedWorkflow
    {
        [Workflow]
        public void Execute()
        {
            Newtonsoft.Json.Linq.JArray arr = default;
            // DeserializeJsonArray は対応表が無いので XAML 経由（coded/_activities/DeserializeJsonArray_e0b73d.xaml）
            var __xaml1 = RunWorkflow("coded/_activities/DeserializeJsonArray_e0b73d.xaml", new Dictionary<string, object> { ["in_JsonString"] = "[10, 20, 30]" });
            arr = (Newtonsoft.Json.Linq.JArray)__xaml1["out_JsonArray"];
            Log(message: "count=" + arr.Count.ToString() + ", last=" + arr[2].ToString(), level: UiPath.CodedWorkflows.LogLevel.Info);
        }
    }
}
