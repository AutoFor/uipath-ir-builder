using System;
using System.Collections.Generic;
using System.Data;
using System.IO;
using System.Linq;
using UiPath.CodedWorkflows;
using UiPath.Platform.ResourceHandling;

namespace CatalogProbeNet8
{
    // tools/ir/gen-coded.ts で IR（AnchorContextAware_Full）から生成。手で直さず IR を直す
    public class AnchorContextAware_Full : CodedWorkflow
    {
        [Workflow]
        public void Execute()
        {
            // コンテキスト アンカー（全部入り）
            // AnchorContextAware はCoded API が無い（Coded API なし（Classic のアンカー（Anchor2Data）。Coded の API なし））ので XAML 経由（coded/_xaml/AnchorContextAware_Full_1.xaml）
            RunWorkflow("coded/_xaml/AnchorContextAware_Full_1.xaml", null);
        }
    }
}
