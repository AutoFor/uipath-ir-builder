using System;
using System.Collections.Generic;
using System.Data;
using System.IO;
using System.Linq;
using UiPath.CodedWorkflows;
using UiPath.Platform.ResourceHandling;

namespace CatalogProbeNet8
{
    // tools/ir/gen-coded.ts で IR（NewAddTestDataQueueItem_Min）から生成。手で直さず IR を直す
    public class NewAddTestDataQueueItem_Min : CodedWorkflow
    {
        [Workflow]
        public void Execute()
        {
            // テストデータキューに追加
            testing.AddTestDataQueueItem(queueName: "IRTestDataQueue", itemInformation: new Dictionary<string, object> { ["customer"] = "A-001" });
            Log(message: "追加した", level: UiPath.CodedWorkflows.LogLevel.Info);
        }
    }
}
