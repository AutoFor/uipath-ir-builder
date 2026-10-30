using System;
using System.Collections.Generic;
using System.Data;
using System.IO;
using System.Linq;
using UiPath.CodedWorkflows;
using UiPath.Platform.ResourceHandling;

namespace CatalogProbeNet8
{
    // tools/ir/gen-coded.ts で IR（BulkAddQueueItems_Full）から生成。手で直さず IR を直す
    public class BulkAddQueueItems_Full : CodedWorkflow
    {
        [Workflow]
        public void Execute()
        {
            DataTable table = new DataTable();
            DataTable failed = default;
            // 一括追加
            failed = system.BulkAddQueueItems(queueItemsDataTable: table, queueName: "IRQueue", folderPath: "Shared", commitType: UiPath.Core.Activities.BulkAddQueueItems.CommitTypeEnum.ProcessAllIndependently, timeoutMS: 30000);
            Log(message: "失敗した行数: " + failed.Rows.Count.ToString(), level: UiPath.CodedWorkflows.LogLevel.Info);
        }
    }
}
