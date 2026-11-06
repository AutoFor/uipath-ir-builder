using System;
using System.Collections.Generic;
using System.Data;
using System.IO;
using System.Linq;
using UiPath.CodedWorkflows;
using UiPath.Platform.ResourceHandling;

namespace CatalogProbeNet8
{
    // tools/ir/gen-coded.ts で IR（NewAddTestDataQueueItem_Full）から生成。手で直さず IR を直す
    public class NewAddTestDataQueueItem_Full : CodedWorkflow
    {
        [Workflow]
        public void Execute()
        {
            // テストデータキューに追加
            testing.AddTestDataQueueItem(queueName: "IRTestDataQueue", itemInformation: new Dictionary<string, object> { ["customer"] = "A-001", ["count"] = 3 }, folderPath: "Shared", timeoutMs: 30000);
            Log(message: "追加した", level: UiPath.CodedWorkflows.LogLevel.Info);
        }
    }
}
