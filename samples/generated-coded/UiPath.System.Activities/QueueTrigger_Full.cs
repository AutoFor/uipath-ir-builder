using System;
using System.Collections.Generic;
using System.Data;
using System.IO;
using System.Linq;
using UiPath.CodedWorkflows;
using UiPath.Platform.ResourceHandling;

namespace CatalogProbeNet8
{
    // tools/ir/gen-coded.ts で IR（QueueTrigger_Full）から生成。手で直さず IR を直す
    public class QueueTrigger_Full : CodedWorkflow
    {
        [Workflow]
        public void Execute()
        {
            QueueItem qi = default;
            QueueItem eq = default;
            // キュートリガー
            // QueueTrigger はCoded API が無い（Coded API なし（トリガーは ISystemService に無い））ので XAML 経由（coded/_activities/QueueTrigger_966a11.xaml）
            var __xaml1 = RunWorkflow("coded/_activities/QueueTrigger_966a11.xaml", null);
            eq = (QueueItem)__xaml1["out_ExtractedQueueItem"];
            qi = (UiPath.Core.QueueItem)__xaml1["out_TransactionItem"];
            Log(message: "キューで開始した", level: UiPath.CodedWorkflows.LogLevel.Info);
        }
    }
}
