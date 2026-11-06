using System;
using System.Collections.Generic;
using System.Data;
using System.IO;
using System.Linq;
using UiPath.CodedWorkflows;
using UiPath.Platform.ResourceHandling;

namespace CatalogProbeNet8
{
    // tools/ir/gen-coded.ts で IR（IndicateOnScreen_Full）から生成。手で直さず IR を直す
    public class IndicateOnScreen_Full : CodedWorkflow
    {
        [Workflow]
        public void Execute()
        {
            UiElement el = default;
            // 画面で指す（全部入り）
            // IndicateOnScreen はCoded API が無い（Coded API なし（Classic の画面上の指示（人の操作を待つ）。Coded の API なし））ので XAML 経由（coded/_xaml/IndicateOnScreen_Full_1.xaml）
            var __xaml1 = RunWorkflow("coded/_xaml/IndicateOnScreen_Full_1.xaml", new Dictionary<string, object> { ["el"] = el });
            el = (UiElement)__xaml1["el"];
        }
    }
}
