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
    // tools/ir/gen-coded.ts で IR（AddTransactionItem_Var）から生成。手で直さず IR を直す
    public class AddTransactionItem_Var : CodedWorkflow
    {
        [Workflow]
        public void Execute()
        {
            UiPath.Core.QueueItem item = default;
            Dictionary<String, Object> tinfo = new Dictionary<String, Object>();
            item = system.AddTransactionItem(queueType: "IRQueue", folderPath: "Shared", reference: "IR-REF-002", transactionInformation: tinfo, timeoutMS: 30000);
            Log(message: "追加した: " + item.Reference, level: UiPath.CodedWorkflows.LogLevel.Info);
        }
    }
}
