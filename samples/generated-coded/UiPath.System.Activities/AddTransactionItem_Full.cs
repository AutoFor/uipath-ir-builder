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
    // tools/ir/gen-coded.ts で IR（AddTransactionItem_Full）から生成。手で直さず IR を直す
    public class AddTransactionItem_Full : CodedWorkflow
    {
        [Workflow]
        public void Execute()
        {
            UiPath.Core.QueueItem item = default;
            Object sd = default;
            // トランザクションを追加
            item = system.AddTransactionItem(queueType: "IRQueue", folderPath: "Shared", reference: "IR-REF-001", transactionInformation: new Dictionary<string, object> { ["customer"] = "A-001", ["count"] = 3 }, timeoutMS: 30000);
            sd = item.SpecificContent;
            Log(message: "追加した: " + item.Reference, level: UiPath.CodedWorkflows.LogLevel.Info);
        }
    }
}
