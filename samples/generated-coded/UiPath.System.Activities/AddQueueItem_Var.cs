using System;
using System.Collections.Generic;
using System.Data;
using System.IO;
using System.Linq;
using UiPath.CodedWorkflows;
using UiPath.Platform.ResourceHandling;

namespace CatalogProbeNet8
{
    // tools/ir/gen-coded.ts で IR（AddQueueItem_Var）から生成。手で直さず IR を直す
    public class AddQueueItem_Var : CodedWorkflow
    {
        [Workflow]
        public void Execute()
        {
            Dictionary<String, Object> qinfo = new Dictionary<String, Object>();
            system.AddQueueItem(queueType: "IRQueue", folderPath: "Shared", dueDate: DateTime.Now.AddDays(2), itemInformationCollection: qinfo, deferDate: DateTime.Now.AddDays(1), priority: UiPath.Core.QueueItemPriority.Low, reference: "IR-REF-004", timeoutMS: 30000);
            Log(message: "キューに追加した", level: UiPath.CodedWorkflows.LogLevel.Info);
        }
    }
}
