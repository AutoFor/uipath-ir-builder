using System;
using System.Collections.Generic;
using System.Data;
using System.IO;
using System.Linq;
using UiPath.CodedWorkflows;
using UiPath.Platform.ResourceHandling;

namespace CatalogProbeNet8
{
    // tools/ir/gen-coded.ts で IR（BulkAddTestDataQueue_Min）から生成。手で直さず IR を直す
    public class BulkAddTestDataQueue_Min : CodedWorkflow
    {
        [Workflow]
        public void Execute()
        {
            DataTable dt = new DataTable();
            // まとめて追加
            testing.BulkAddTestDataQueueItems(queueName: "IRTestDataQueue", queueItemsDataTable: dt);
            Log(message: "まとめて追加した", level: UiPath.CodedWorkflows.LogLevel.Info);
        }
    }
}
