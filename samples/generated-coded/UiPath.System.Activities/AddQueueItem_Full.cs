using System;
using System.Collections.Generic;
using System.Data;
using System.IO;
using System.Linq;
using UiPath.CodedWorkflows;
using UiPath.Platform.ResourceHandling;

namespace CatalogProbeNet8
{
    // tools/ir/gen-coded.ts で IR（AddQueueItem_Full）から生成。手で直さず IR を直す
    public class AddQueueItem_Full : CodedWorkflow
    {
        [Workflow]
        public void Execute()
        {
            // キューに追加
            system.AddQueueItem(queueType: "IRQueue", folderPath: "Shared", dueDate: DateTime.Now.AddDays(2), itemInformationCollection: new Dictionary<string, object> { ["customer"] = "A-001", ["count"] = 3 }, deferDate: DateTime.Now.AddDays(1), priority: UiPath.Core.QueueItemPriority.High, reference: "IR-REF-003", timeoutMS: 30000);
            Log(message: "キューに追加した", level: UiPath.CodedWorkflows.LogLevel.Info);
        }
    }
}
