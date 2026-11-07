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
    // tools/ir/gen-coded.ts で IR（SetTransactionStatus_Full）から生成。手で直さず IR を直す
    public class SetTransactionStatus_Full : CodedWorkflow
    {
        [Workflow]
        public void Execute()
        {
            UiPath.Core.QueueItem item = default;
            // キューから1件取る
            item = system.GetQueueItem(queueType: "IRQueue");
            // ステータスを設定
            system.SetTransactionStatus(transactionItem: item, status: UiPath.Core.ProcessingStatus.Failed, analytics: new Dictionary<string, object> { ["steps"] = 5 }, output: new Dictionary<string, object> { ["result"] = "NG" }, details: "詳細", errorType: UiPath.Core.Activities.ErrorType.Application, reason: "理由", timeoutMS: 30000);
            Log(message: "ステータスを設定した", level: UiPath.CodedWorkflows.LogLevel.Info);
        }
    }
}
