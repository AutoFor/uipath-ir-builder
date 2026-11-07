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
    // tools/ir/gen-coded.ts で IR（GetQueueItems_Min）から生成。手で直さず IR を直す
    public class GetQueueItems_Min : CodedWorkflow
    {
        [Workflow]
        public void Execute()
        {
            IEnumerable<UiPath.Core.QueueItem> items = default;
            items = system.GetQueueItems(queueName: "IRQueue");
            Log(message: Convert.ToString("取得した件数: " + items.Count()), level: UiPath.CodedWorkflows.LogLevel.Info);
        }
    }
}
