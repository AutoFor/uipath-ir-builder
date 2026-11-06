using System;
using System.Collections.Generic;
using System.Data;
using System.IO;
using System.Linq;
using UiPath.CodedWorkflows;
using UiPath.Platform.ResourceHandling;

namespace CatalogProbeNet8
{
    // tools/ir/gen-coded.ts で IR（WaitForQueueItemAndResume_Full）から生成。手で直さず IR を直す
    public class WaitForQueueItemAndResume_Full : CodedWorkflow
    {
        [Workflow]
        public void Execute()
        {
            QueueItemData item = default;
            // AddQueueItemAndGetReference はCoded API が無い（Coded API なし（1.13.0 の DLL に Coded のサービスが無い。抽出器で services 0 件））ので XAML 経由（coded/_xaml/WaitForQueueItemAndResume_Full_1.xaml）
            var __xaml1 = RunWorkflow("coded/_xaml/WaitForQueueItemAndResume_Full_1.xaml", new Dictionary<string, object> { ["item"] = item });
            item = (QueueItemData)__xaml1["item"];
            // キューの項目を待つ
            // WaitForQueueItemAndResume はCoded API が無い（Coded API なし（1.13.0 の DLL に Coded のサービスが無い。抽出器で services 0 件））ので XAML 経由（coded/_xaml/WaitForQueueItemAndResume_Full_2.xaml）
            var __xaml2 = RunWorkflow("coded/_xaml/WaitForQueueItemAndResume_Full_2.xaml", new Dictionary<string, object> { ["item"] = item });
            item = (QueueItemData)__xaml2["item"];
            Log(message: "再開した", level: UiPath.CodedWorkflows.LogLevel.Info);
        }
    }
}
