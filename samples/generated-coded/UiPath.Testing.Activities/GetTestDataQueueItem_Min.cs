using System;
using System.Collections.Generic;
using System.Data;
using System.IO;
using System.Linq;
using UiPath.CodedWorkflows;
using UiPath.Platform.ResourceHandling;

namespace CatalogProbeNet8
{
    // tools/ir/gen-coded.ts で IR（GetTestDataQueueItem_Min）から生成。手で直さず IR を直す
    public class GetTestDataQueueItem_Min : CodedWorkflow
    {
        [Workflow]
        public void Execute()
        {
            Dictionary<String, Object> item = default;
            // テストデータを1件取る
            item = testing.GetTestDataQueueItem(queueName: "IRTestDataQueue");
            Log(message: Convert.ToString("件数=" + item.Count.ToString()), level: UiPath.CodedWorkflows.LogLevel.Info);
        }
    }
}
