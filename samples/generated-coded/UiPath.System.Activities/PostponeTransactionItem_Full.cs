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
    // tools/ir/gen-coded.ts で IR（PostponeTransactionItem_Full）から生成。手で直さず IR を直す
    public class PostponeTransactionItem_Full : CodedWorkflow
    {
        [Workflow]
        public void Execute()
        {
            QueueItem item = default;
            // キューから1件取る
            item = system.GetQueueItem(queueType: "IRQueue");
            // トランザクションを延期
            system.PostponeTransactionItem(transactionItem: item, deferDate: DateTime.Now.AddHours(1), dueDate: DateTime.Now.AddDays(1), timeoutMS: 30000);
            Log(message: "延期した", level: UiPath.CodedWorkflows.LogLevel.Info);
        }
    }
}
