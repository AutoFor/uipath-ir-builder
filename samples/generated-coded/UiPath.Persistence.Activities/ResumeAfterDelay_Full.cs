using System;
using System.Collections.Generic;
using System.Data;
using System.IO;
using System.Linq;
using UiPath.CodedWorkflows;
using UiPath.Platform.ResourceHandling;

namespace CatalogProbeNet8
{
    // tools/ir/gen-coded.ts で IR（ResumeAfterDelay_Full）から生成。手で直さず IR を直す
    public class ResumeAfterDelay_Full : CodedWorkflow
    {
        [Workflow]
        public void Execute()
        {
            DateTime d = default;
            // 時刻まで待つ
            // ResumeAfterDelay はCoded API が無い（Coded API なし（1.13.0 の DLL に Coded のサービスが無い。抽出器で services 0 件））ので XAML 経由（coded/_xaml/ResumeAfterDelay_Full_1.xaml）
            var __xaml1 = RunWorkflow("coded/_xaml/ResumeAfterDelay_Full_1.xaml", new Dictionary<string, object> { ["d"] = d });
            d = (DateTime)__xaml1["d"];
        }
    }
}
