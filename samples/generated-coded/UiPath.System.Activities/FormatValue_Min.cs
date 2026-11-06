using System;
using System.Collections.Generic;
using System.Data;
using System.IO;
using System.Linq;
using UiPath.CodedWorkflows;
using UiPath.Platform.ResourceHandling;

namespace CatalogProbeNet8
{
    // tools/ir/gen-coded.ts で IR（FormatValue_Min）から生成。手で直さず IR を直す
    public class FormatValue_Min : CodedWorkflow
    {
        [Workflow]
        public void Execute()
        {
            UiPath.Core.GenericValue gv = default;
            gv = 1234567.891;
            // FormatValue はCoded API が無い（Coded API なし（ISystemService に該当するメソッドが無い））ので XAML 経由（coded/_xaml/FormatValue_Min_1.xaml）
            var __xaml1 = RunWorkflow("coded/_xaml/FormatValue_Min_1.xaml", new Dictionary<string, object> { ["gv"] = gv });
            gv = (UiPath.Core.GenericValue)__xaml1["gv"];
            Log(message: gv.ToString(), level: UiPath.CodedWorkflows.LogLevel.Info);
        }
    }
}
