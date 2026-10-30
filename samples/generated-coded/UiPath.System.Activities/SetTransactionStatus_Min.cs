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
    // tools/ir/gen-coded.ts で IR（SetTransactionStatus_Min）から生成。手で直さず IR を直す
    public class SetTransactionStatus_Min : CodedWorkflow
    {
        [Workflow]
        public void Execute()
        {
            QueueItem item = default;
            // キューから1件取る
            item = system.GetQueueItem(queueType: "IRQueue");
            system.SetTransactionStatus(transactionItem: item, status: UiPath.Core.ProcessingStatus.Successful);
            Log(message: "ステータスを設定した", level: UiPath.CodedWorkflows.LogLevel.Info);
        }
    }
}
