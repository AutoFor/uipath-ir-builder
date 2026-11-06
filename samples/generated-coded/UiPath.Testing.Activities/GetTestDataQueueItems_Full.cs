using System;
using System.Collections.Generic;
using System.Data;
using System.IO;
using System.Linq;
using UiPath.CodedWorkflows;
using UiPath.Platform.ResourceHandling;

namespace CatalogProbeNet8
{
    // tools/ir/gen-coded.ts で IR（GetTestDataQueueItems_Full）から生成。手で直さず IR を直す
    public class GetTestDataQueueItems_Full : CodedWorkflow
    {
        [Workflow]
        public void Execute()
        {
            List<UiPath.Testing.Core.TestDataQueueItem> items = default;
            // テストデータの一覧を取る
            items = testing.GetTestDataQueueItems(queueName: "IRTestDataQueue", folderPath: "Shared", idFilter: "", testDataQueueItemStatus: UiPath.Testing.Activities.TestDataQueues.Enums.TestDataQueueItemStatus.OnlyNotConsumed, skip: 0, top: 10, timeoutMs: 30000);
            Log(message: Convert.ToString("件数=" + items.Count.ToString()), level: UiPath.CodedWorkflows.LogLevel.Info);
        }
    }
}
