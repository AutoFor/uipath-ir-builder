using System;
using System.Collections.Generic;
using System.Data;
using System.IO;
using System.Linq;
using UiPath.CodedWorkflows;
using UiPath.Platform.ResourceHandling;
using UiPath.Core;

namespace CatalogProbeNet8
{
    // tools/ir/gen-coded.ts で IR（DeleteQueueItems_Full）から生成。手で直さず IR を直す
    public class DeleteQueueItems_Full : CodedWorkflow
    {
        [Workflow]
        public void Execute()
        {
            IEnumerable<UiPath.Core.QueueItem> items = default;
            items = system.GetQueueItems(queueName: "IRQueue");
            // キューの項目を削除
            system.DeleteQueueItems(queueItems: items, timeoutMS: 30000);
            Log(message: "削除した", level: UiPath.CodedWorkflows.LogLevel.Info);
        }
    }
}
