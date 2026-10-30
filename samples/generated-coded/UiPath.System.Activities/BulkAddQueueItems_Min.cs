using System;
using System.Collections.Generic;
using System.Data;
using System.IO;
using System.Linq;
using UiPath.CodedWorkflows;
using UiPath.Platform.ResourceHandling;

namespace CatalogProbeNet8
{
    // tools/ir/gen-coded.ts で IR（BulkAddQueueItems_Min）から生成。手で直さず IR を直す
    public class BulkAddQueueItems_Min : CodedWorkflow
    {
        [Workflow]
        public void Execute()
        {
            DataTable table = new DataTable();
            system.BulkAddQueueItems(queueItemsDataTable: table, queueName: "IRQueue");
            Log(message: "一括追加した", level: UiPath.CodedWorkflows.LogLevel.Info);
        }
    }
}
