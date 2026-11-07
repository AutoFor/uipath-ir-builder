using System;
using System.Collections.Generic;
using System.Data;
using System.IO;
using System.Linq;
using UiPath.CodedWorkflows;
using UiPath.Platform.ResourceHandling;

namespace CatalogProbeNet8
{
    // tools/ir/gen-coded.ts で IR（AddQueueItemAndGetReference_Full）から生成。手で直さず IR を直す
    public class AddQueueItemAndGetReference_Full : CodedWorkflow
    {
        [Workflow]
        public void Execute()
        {
            UiPath.Persistence.Activities.Queue.QueueItemData item = default;
            // キューに足す
            // AddQueueItemAndGetReference はCoded API が無い（Coded API なし（1.13.0 の DLL に Coded のサービスが無い。抽出器で services 0 件））ので XAML 経由（coded/_activities/AddQueueItemAndGetReference_7dafe0.xaml）
            var __xaml1 = RunWorkflow("coded/_activities/AddQueueItemAndGetReference_7dafe0.xaml", new Dictionary<string, object> { ["in_ContinueOnError"] = false, ["in_DeferDate"] = DateTime.Now.AddHours(1), ["in_DueDate"] = DateTime.Now.AddDays(1), ["in_FolderPath"] = "Shared", ["in_QueueName"] = "Invoices", ["in_Reference"] = "INV-1", ["in_TimeoutMs"] = 30000, ["in_ItemInformation_No"] = "INV-1" });
            item = (UiPath.Persistence.Activities.Queue.QueueItemData)__xaml1["out_QueueItemOutput"];
        }
    }
}
