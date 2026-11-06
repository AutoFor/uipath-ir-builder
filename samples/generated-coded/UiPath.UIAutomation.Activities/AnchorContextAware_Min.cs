using System;
using System.Collections.Generic;
using System.Data;
using System.IO;
using System.Linq;
using UiPath.CodedWorkflows;
using UiPath.Platform.ResourceHandling;

namespace CatalogProbeNet8
{
    // tools/ir/gen-coded.ts で IR（AnchorContextAware_Min）から生成。手で直さず IR を直す
    public class AnchorContextAware_Min : CodedWorkflow
    {
        [Workflow]
        public void Execute()
        {
            // コンテキスト アンカー
            // AnchorContextAware はCoded API が無い（Coded API なし（Classic のアンカー（Anchor2Data）。Coded の API なし））ので XAML 経由（coded/_xaml/AnchorContextAware_Min_1.xaml）
            RunWorkflow("coded/_xaml/AnchorContextAware_Min_1.xaml", null);
        }
    }
}
