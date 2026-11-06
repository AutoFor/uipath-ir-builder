using System;
using System.Collections.Generic;
using System.Data;
using System.IO;
using System.Linq;
using UiPath.CodedWorkflows;
using UiPath.Platform.ResourceHandling;

namespace CatalogProbeNet8
{
    // tools/ir/gen-coded.ts で IR（FileChangeTriggerV2_Full）から生成。手で直さず IR を直す
    public class FileChangeTriggerV2_Full : CodedWorkflow
    {
        [Workflow]
        public void Execute()
        {
            // ファイルの変更(V2)
            // FileChangeTriggerV2 はCoded API が無い（Coded API なし（トリガーは ISystemService に無い））ので XAML 経由（coded/_xaml/FileChangeTriggerV2_Full_1.xaml）
            RunWorkflow("coded/_xaml/FileChangeTriggerV2_Full_1.xaml", null);
        }
    }
}
