using System;
using System.Collections.Generic;
using System.Data;
using System.IO;
using System.Linq;
using UiPath.CodedWorkflows;
using UiPath.Platform.ResourceHandling;

namespace CatalogProbeNet8
{
    // tools/ir/gen-coded.ts で IR（ClickToolbarButton_Full）から生成。手で直さず IR を直す
    public class ClickToolbarButton_Full : CodedWorkflow
    {
        [Workflow]
        public void Execute()
        {
            // SAP Logon を開く（Classic）
            // OpenApplication はCoded API が無い（Coded API なし（Classic の UI 操作。Coded の uiAutomation が扱うのは Modern のターゲット（TargetAnchorableModel）だけ））ので XAML 経由（coded/_xaml/ClickToolbarButton_Full_1.xaml）
            RunWorkflow("coded/_xaml/ClickToolbarButton_Full_1.xaml", null);
        }
    }
}
