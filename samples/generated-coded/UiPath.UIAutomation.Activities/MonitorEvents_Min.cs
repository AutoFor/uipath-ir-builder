using System;
using System.Collections.Generic;
using System.Data;
using System.IO;
using System.Linq;
using UiPath.CodedWorkflows;
using UiPath.Platform.ResourceHandling;

namespace CatalogProbeNet8
{
    // tools/ir/gen-coded.ts で IR（MonitorEvents_Min）から生成。手で直さず IR を直す
    public class MonitorEvents_Min : CodedWorkflow
    {
        [Workflow]
        public void Execute()
        {
            // イベントを監視
            // MonitorEvents はCoded API が無い（Coded API なし（Classic のイベント・待機。Coded の uiAutomation が扱うのは Modern のターゲットだけ））ので XAML 経由（coded/_xaml/MonitorEvents_Min_1.xaml）
            RunWorkflow("coded/_xaml/MonitorEvents_Min_1.xaml", null);
        }
    }
}
