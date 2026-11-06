using System;
using System.Collections.Generic;
using System.Data;
using System.IO;
using System.Linq;
using UiPath.CodedWorkflows;
using UiPath.Platform.ResourceHandling;

namespace CatalogProbeNet8
{
    // tools/ir/gen-coded.ts で IR（DeleteTestDataQueueItems_Min）から生成。手で直さず IR を直す
    public class DeleteTestDataQueueItems_Min : CodedWorkflow
    {
        [Workflow]
        public void Execute()
        {
            List<UiPath.Testing.Core.TestDataQueueItem> items = default;
            items = testing.GetTestDataQueueItems(queueName: "IRTestDataQueue");
            // テストデータを削除
            testing.DeleteTestDataQueueItems(testDataQueueItems: items);
            Log(message: "削除した", level: UiPath.CodedWorkflows.LogLevel.Info);
        }
    }
}
