using System;
using System.Collections.Generic;
using System.Data;
using System.IO;
using System.Linq;
using UiPath.CodedWorkflows;
using UiPath.Platform.ResourceHandling;

namespace CatalogProbeNet8
{
    // tools/ir/gen-coded.ts で IR（WaitForQueueItemAndResume_Min）から生成。手で直さず IR を直す
    public class WaitForQueueItemAndResume_Min : CodedWorkflow
    {
        [Workflow]
        public void Execute()
        {
            QueueItemData item = default;
            // AddQueueItemAndGetReference はCoded API が無い（Coded API なし（1.13.0 の DLL に Coded のサービスが無い。抽出器で services 0 件））ので XAML 経由（coded/_activities/AddQueueItemAndGetReference_3b7bd4.xaml）
            var __xaml1 = RunWorkflow("coded/_activities/AddQueueItemAndGetReference_3b7bd4.xaml", new Dictionary<string, object> { ["in_QueueName"] = "Invoices", ["in_ItemInformation_No"] = "INV-1" });
            item = (UiPath.Persistence.Activities.Queue.QueueItemData)__xaml1["out_QueueItemOutput"];
            // WaitForQueueItemAndResume はCoded API が無い（Coded API なし（1.13.0 の DLL に Coded のサービスが無い。抽出器で services 0 件））ので XAML 経由（coded/_activities/WaitForQueueItemAndResume.xaml）
            RunWorkflow("coded/_activities/WaitForQueueItemAndResume.xaml", new Dictionary<string, object> { ["in_QueueItemInput"] = item });
            Log(message: "再開した", level: UiPath.CodedWorkflows.LogLevel.Info);
        }
    }
}
