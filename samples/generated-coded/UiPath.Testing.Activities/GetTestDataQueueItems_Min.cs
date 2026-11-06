using System;
using System.Collections.Generic;
using System.Data;
using System.IO;
using System.Linq;
using UiPath.CodedWorkflows;
using UiPath.Platform.ResourceHandling;

namespace CatalogProbeNet8
{
    // tools/ir/gen-coded.ts で IR（GetTestDataQueueItems_Min）から生成。手で直さず IR を直す
    public class GetTestDataQueueItems_Min : CodedWorkflow
    {
        [Workflow]
        public void Execute()
        {
            List<UiPath.Testing.Core.TestDataQueueItem> items = default;
            // テストデータの一覧を取る
            items = testing.GetTestDataQueueItems(queueName: "IRTestDataQueue");
            Log(message: Convert.ToString("件数=" + items.Count.ToString()), level: UiPath.CodedWorkflows.LogLevel.Info);
        }
    }
}
