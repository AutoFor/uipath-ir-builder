using System;
using System.Collections.Generic;
using System.Data;
using System.IO;
using System.Linq;
using UiPath.CodedWorkflows;
using UiPath.Platform.ResourceHandling;

namespace CatalogProbeNet8
{
    // tools/ir/gen-coded.ts で IR（IndicateOnScreen_Min）から生成。手で直さず IR を直す
    public class IndicateOnScreen_Min : CodedWorkflow
    {
        [Workflow]
        public void Execute()
        {
            UiElement el = default;
            // IndicateOnScreen はCoded API が無い（Coded API なし（Classic の画面上の指示（人の操作を待つ）。Coded の API なし））ので XAML 経由（coded/_activities/IndicateOnScreen_7dcd10.xaml）
            var __xaml1 = RunWorkflow("coded/_activities/IndicateOnScreen_7dcd10.xaml", null);
            el = (UiPath.Core.UiElement)__xaml1["out_SelectedUiElement"];
        }
    }
}
