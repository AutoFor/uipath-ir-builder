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
    // tools/ir/gen-coded.ts で IR（GetQueueItems_Full）から生成。手で直さず IR を直す
    public class GetQueueItems_Full : CodedWorkflow
    {
        [Workflow]
        public void Execute()
        {
            IEnumerable<UiPath.Core.QueueItem> items = default;
            // キューの項目を取得
            items = system.GetQueueItems(queueName: "IRQueue", folderPath: "Shared", duration: 60, from: DateTime.Now.AddDays(-1), priority: 1, queueItemStates: UiPath.Core.Activities.QueueItemStates.New, to: DateTime.Now, filterStrategy: UiPath.Core.Activities.ReferenceFilterStrategy.Equals, reference: "IR-REF-001", skip: 0, top: 10, timeoutMS: 30000);
            Log(message: Convert.ToString("取得した件数: " + items.Count()), level: UiPath.CodedWorkflows.LogLevel.Info);
        }
    }
}
