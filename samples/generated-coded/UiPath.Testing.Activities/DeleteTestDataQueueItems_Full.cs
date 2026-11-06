using System;
using System.Collections.Generic;
using System.Data;
using System.IO;
using System.Linq;
using UiPath.CodedWorkflows;
using UiPath.Platform.ResourceHandling;

namespace CatalogProbeNet8
{
    // tools/ir/gen-coded.ts で IR（DeleteTestDataQueueItems_Full）から生成。手で直さず IR を直す
    public class DeleteTestDataQueueItems_Full : CodedWorkflow
    {
        [Workflow]
        public void Execute()
        {
            List<UiPath.Testing.Core.TestDataQueueItem> items = default;
            items = testing.GetTestDataQueueItems(queueName: "IRTestDataQueue", folderPath: "Shared");
            // テストデータを削除
            testing.DeleteTestDataQueueItems(testDataQueueItems: items, folderPath: "Shared", timeoutMs: 30000);
            Log(message: "削除した", level: UiPath.CodedWorkflows.LogLevel.Info);
        }
    }
}
