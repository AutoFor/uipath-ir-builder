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
    // tools/ir/gen-coded.ts で IR（SetTransactionProgress_Min）から生成。手で直さず IR を直す
    public class SetTransactionProgress_Min : CodedWorkflow
    {
        [Workflow]
        public void Execute()
        {
            UiPath.Core.QueueItem item = default;
            // キューから1件取る
            item = system.GetQueueItem(queueType: "IRQueue");
            system.SetTransactionProgress(transactionItem: item, progress: "処理中");
            Log(message: "進捗を設定した", level: UiPath.CodedWorkflows.LogLevel.Info);
        }
    }
}
