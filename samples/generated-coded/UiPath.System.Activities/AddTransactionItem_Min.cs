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
    // tools/ir/gen-coded.ts で IR（AddTransactionItem_Min）から生成。手で直さず IR を直す
    public class AddTransactionItem_Min : CodedWorkflow
    {
        [Workflow]
        public void Execute()
        {
            QueueItem item = default;
            item = system.AddTransactionItem(queueType: "IRQueue");
            Log(message: "追加した: " + item.Reference, level: UiPath.CodedWorkflows.LogLevel.Info);
        }
    }
}
