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
    // tools/ir/gen-coded.ts で IR（SetTransactionProgress_Full）から生成。手で直さず IR を直す
    public class SetTransactionProgress_Full : CodedWorkflow
    {
        [Workflow]
        public void Execute()
        {
            QueueItem item = default;
            // キューから1件取る
            item = system.GetQueueItem(queueType: "IRQueue");
            // 進捗を設定
            system.SetTransactionProgress(transactionItem: item, progress: "50%", timeoutMS: 30000);
            Log(message: "進捗を設定した", level: UiPath.CodedWorkflows.LogLevel.Info);
        }
    }
}
