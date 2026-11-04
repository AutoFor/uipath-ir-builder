using System;
using System.Collections.Generic;
using System.Data;
using System.IO;
using System.Linq;
using UiPath.CodedWorkflows;
using UiPath.Platform.ResourceHandling;

namespace CatalogProbeNet8
{
    // tools/ir/gen-coded.ts で IR（Address_Min）から生成。手で直さず IR を直す
    public class Address_Min : CodedWorkflow
    {
        [Workflow]
        public void Execute()
        {
            Dictionary<String, String> addr = default;
            // 住所
            addr = testing.Address(null, null);
            Log(message: Convert.ToString("hasKeys=" + (addr.Count > 0)), level: UiPath.CodedWorkflows.LogLevel.Info);
            Log(message: Convert.ToString(string.Join(",", addr.Keys)), level: UiPath.CodedWorkflows.LogLevel.Info);
        }
    }
}
