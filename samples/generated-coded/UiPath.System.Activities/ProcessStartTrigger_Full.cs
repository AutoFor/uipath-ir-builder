using System;
using System.Collections.Generic;
using System.Data;
using System.IO;
using System.Linq;
using UiPath.CodedWorkflows;
using UiPath.Platform.ResourceHandling;

namespace CatalogProbeNet8
{
    // tools/ir/gen-coded.ts で IR（ProcessStartTrigger_Full）から生成。手で直さず IR を直す
    public class ProcessStartTrigger_Full : CodedWorkflow
    {
        [Workflow]
        public void Execute()
        {
            // プロセス開始
            // ProcessStartTrigger はCoded API が無い（Coded API なし（トリガーは ISystemService に無い））ので XAML 経由（coded/_xaml/ProcessStartTrigger_Full_1.xaml）
            RunWorkflow("coded/_xaml/ProcessStartTrigger_Full_1.xaml", null);
        }
    }
}
