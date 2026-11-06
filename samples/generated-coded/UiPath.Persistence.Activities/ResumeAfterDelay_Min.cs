using System;
using System.Collections.Generic;
using System.Data;
using System.IO;
using System.Linq;
using UiPath.CodedWorkflows;
using UiPath.Platform.ResourceHandling;

namespace CatalogProbeNet8
{
    // tools/ir/gen-coded.ts で IR（ResumeAfterDelay_Min）から生成。手で直さず IR を直す
    public class ResumeAfterDelay_Min : CodedWorkflow
    {
        [Workflow]
        public void Execute()
        {
            // ResumeAfterDelay はCoded API が無い（Coded API なし（1.13.0 の DLL に Coded のサービスが無い。抽出器で services 0 件））ので XAML 経由（coded/_xaml/ResumeAfterDelay_Min_1.xaml）
            RunWorkflow("coded/_xaml/ResumeAfterDelay_Min_1.xaml", null);
            Log(message: "再開した", level: UiPath.CodedWorkflows.LogLevel.Info);
        }
    }
}
