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
    // tools/ir/gen-coded.ts で IR（WaitQueueItem_Full）から生成。手で直さず IR を直す
    public class WaitQueueItem_Full : CodedWorkflow
    {
        [Workflow]
        public void Execute()
        {
            QueueItem item = default;
            // キュー項目を待つ
            item = system.WaitQueueItem(queueName: "IRQueue", folderPath: "Shared", pollTimeMS: 5000, filterStrategy: UiPath.Core.Activities.ReferenceFilterStrategy.Equals, reference: "IR-REF-001", timeoutMS: 30000);
            Log(message: "待ち終わった: " + item.Reference, level: UiPath.CodedWorkflows.LogLevel.Info);
        }
    }
}
