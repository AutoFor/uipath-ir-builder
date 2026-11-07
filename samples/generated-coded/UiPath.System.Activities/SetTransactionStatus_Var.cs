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
    // tools/ir/gen-coded.ts で IR（SetTransactionStatus_Var）から生成。手で直さず IR を直す
    public class SetTransactionStatus_Var : CodedWorkflow
    {
        [Workflow]
        public void Execute()
        {
            UiPath.Core.QueueItem item = default;
            Dictionary<String, Object> ana = new Dictionary<String, Object>();
            Dictionary<String, Object> outd = new Dictionary<String, Object>();
            // キューから1件取る
            item = system.GetQueueItem(queueType: "IRQueue");
            system.SetTransactionStatus(transactionItem: item, status: UiPath.Core.ProcessingStatus.Failed, analytics: ana, output: outd, details: "詳細", errorType: UiPath.Core.Activities.ErrorType.Business, reason: "理由", timeoutMS: 30000);
            Log(message: "ステータスを設定した", level: UiPath.CodedWorkflows.LogLevel.Info);
        }
    }
}
