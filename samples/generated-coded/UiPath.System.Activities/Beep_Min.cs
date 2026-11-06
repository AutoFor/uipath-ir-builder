using System;
using System.Collections.Generic;
using System.Data;
using System.IO;
using System.Linq;
using UiPath.CodedWorkflows;
using UiPath.Platform.ResourceHandling;

namespace CatalogProbeNet8
{
    // tools/ir/gen-coded.ts で IR（Beep_Min）から生成。手で直さず IR を直す
    public class Beep_Min : CodedWorkflow
    {
        [Workflow]
        public void Execute()
        {
            // Beep はCoded API が無い（Coded API なし（ISystemService にも基底クラスにも無い））ので XAML 経由（coded/_xaml/Beep_Min_1.xaml）
            RunWorkflow("coded/_xaml/Beep_Min_1.xaml", null);
            Log(message: "Beep の後", level: UiPath.CodedWorkflows.LogLevel.Info);
        }
    }
}
