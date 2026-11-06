using System;
using System.Collections.Generic;
using System.Data;
using System.IO;
using System.Linq;
using UiPath.CodedWorkflows;
using UiPath.Platform.ResourceHandling;

namespace CatalogProbeNet8
{
    // tools/ir/gen-coded.ts で IR（MouseTriggerV2_Min）から生成。手で直さず IR を直す
    public class MouseTriggerV2_Min : CodedWorkflow
    {
        [Workflow]
        public void Execute()
        {
            // トリガーの範囲
            // TriggerScope はCoded API が無い（Coded API なし（トリガーは ISystemService に無い））ので XAML 経由（coded/_xaml/MouseTriggerV2_Min_1.xaml）
            RunWorkflow("coded/_xaml/MouseTriggerV2_Min_1.xaml", null);
        }
    }
}
