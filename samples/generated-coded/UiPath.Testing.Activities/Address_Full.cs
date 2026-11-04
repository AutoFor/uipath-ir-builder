using System;
using System.Collections.Generic;
using System.Data;
using System.IO;
using System.Linq;
using UiPath.CodedWorkflows;
using UiPath.Platform.ResourceHandling;

namespace CatalogProbeNet8
{
    // tools/ir/gen-coded.ts で IR（Address_Full）から生成。手で直さず IR を直す
    public class Address_Full : CodedWorkflow
    {
        [Workflow]
        public void Execute()
        {
            Dictionary<String, String> addr = default;
            // 国と都市を指定
            addr = testing.Address("USA", "New York");
            Log(message: Convert.ToString("country=" + addr["Country"] + " city=" + addr["City"]), level: UiPath.CodedWorkflows.LogLevel.Info);
        }
    }
}
