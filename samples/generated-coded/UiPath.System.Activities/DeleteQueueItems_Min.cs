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
    // tools/ir/gen-coded.ts で IR（DeleteQueueItems_Min）から生成。手で直さず IR を直す
    public class DeleteQueueItems_Min : CodedWorkflow
    {
        [Workflow]
        public void Execute()
        {
            IEnumerable<QueueItem> items = default;
            items = system.GetQueueItems(queueName: "IRQueue");
            system.DeleteQueueItems(queueItems: items);
            Log(message: "削除した", level: UiPath.CodedWorkflows.LogLevel.Info);
        }
    }
}
