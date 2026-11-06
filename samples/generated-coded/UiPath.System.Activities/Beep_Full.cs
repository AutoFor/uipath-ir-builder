using System;
using System.Collections.Generic;
using System.Data;
using System.IO;
using System.Linq;
using UiPath.CodedWorkflows;
using UiPath.Platform.ResourceHandling;

namespace CatalogProbeNet8
{
    // tools/ir/gen-coded.ts で IR（Beep_Full）から生成。手で直さず IR を直す
    public class Beep_Full : CodedWorkflow
    {
        [Workflow]
        public void Execute()
        {
            // 1回目
            // Beep はCoded API が無い（Coded API なし（ISystemService にも基底クラスにも無い））ので XAML 経由（coded/_activities/Beep.xaml）
            RunWorkflow("coded/_activities/Beep.xaml", null);
            // 2回目
            // Beep はCoded API が無い（Coded API なし（ISystemService にも基底クラスにも無い））ので XAML 経由（coded/_activities/Beep.xaml）
            RunWorkflow("coded/_activities/Beep.xaml", null);
            Log(message: "2回鳴らした後", level: UiPath.CodedWorkflows.LogLevel.Info);
        }
    }
}
