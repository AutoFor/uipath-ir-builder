using System;
using System.Collections.Generic;
using System.Data;
using System.IO;
using System.Linq;
using UiPath.CodedWorkflows;
using UiPath.Platform.ResourceHandling;

namespace CatalogProbeNet8
{
    // tools/ir/gen-coded.ts で IR（GetPassword_Min）から生成。手で直さず IR を直す
    public class GetPassword_Min : CodedWorkflow
    {
        [Workflow]
        public void Execute()
        {
            String pw = default;
            // GetPassword はCoded API が無い（Coded API なし（Classic の入力ダイアログ。Coded の API なし））ので XAML 経由（coded/_xaml/GetPassword_Min_1.xaml）
            var __xaml1 = RunWorkflow("coded/_xaml/GetPassword_Min_1.xaml", new Dictionary<string, object> { ["pw"] = pw });
            pw = (String)__xaml1["pw"];
        }
    }
}
