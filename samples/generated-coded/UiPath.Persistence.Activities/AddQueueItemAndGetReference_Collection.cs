using System;
using System.Collections.Generic;
using System.Data;
using System.IO;
using System.Linq;
using UiPath.CodedWorkflows;
using UiPath.Platform.ResourceHandling;

namespace CatalogProbeNet8
{
    // tools/ir/gen-coded.ts で IR（AddQueueItemAndGetReference_Collection）から生成。手で直さず IR を直す
    public class AddQueueItemAndGetReference_Collection : CodedWorkflow
    {
        [Workflow]
        public void Execute(Dictionary<String, Object> in_Info)
        {
            UiPath.Persistence.Activities.Queue.QueueItemData item = default;
            // AddQueueItemAndGetReference はCoded API が無い（Coded API なし（1.13.0 の DLL に Coded のサービスが無い。抽出器で services 0 件））ので XAML 経由（coded/_activities/AddQueueItemAndGetReference_5b2511.xaml）
            var __xaml1 = RunWorkflow("coded/_activities/AddQueueItemAndGetReference_5b2511.xaml", new Dictionary<string, object> { ["in_ItemInformationCollection"] = in_Info, ["in_QueueName"] = "Invoices" });
            item = (UiPath.Persistence.Activities.Queue.QueueItemData)__xaml1["out_QueueItemOutput"];
        }
    }
}
