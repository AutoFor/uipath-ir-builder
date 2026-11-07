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
    // tools/ir/gen-coded.ts で IR（GetQueueItem_Full）から生成。手で直さず IR を直す
    public class GetQueueItem_Full : CodedWorkflow
    {
        [Workflow]
        public void Execute()
        {
            UiPath.Core.QueueItem item = default;
            Object sd = default;
            // キューから取得
            item = system.GetQueueItem(queueType: "IRQueue", folderPath: "Shared", filterStrategy: UiPath.Core.Activities.ReferenceFilterStrategy.Equals, reference: "IR-REF-001", timeoutMS: 30000);
            sd = item.SpecificContent;
            Log(message: "取得した: " + item.Reference, level: UiPath.CodedWorkflows.LogLevel.Info);
        }
    }
}
