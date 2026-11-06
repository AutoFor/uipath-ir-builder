using System;
using System.Collections.Generic;
using System.Data;
using System.IO;
using System.Linq;
using UiPath.CodedWorkflows;
using UiPath.Platform.ResourceHandling;

namespace CatalogProbeNet8
{
    // tools/ir/gen-coded.ts で IR（ToUpperLowerTextModification_Min）から生成。手で直さず IR を直す
    public class ToUpperLowerTextModification_Min : CodedWorkflow
    {
        [Workflow]
        public void Execute()
        {
            String out = default;
            // ModifyText はCoded API が無い（Coded API なし（ISystemService に該当するメソッドが無い。個々の加工は ChangeCase / FindAndReplace などで書き分ける））ので XAML 経由（coded/_xaml/ToUpperLowerTextModification_Min_1.xaml）
            var __xaml1 = RunWorkflow("coded/_xaml/ToUpperLowerTextModification_Min_1.xaml", new Dictionary<string, object> { ["out"] = out });
            out = (String)__xaml1["out"];
            Log(message: Convert.ToString("[" + out + "]"), level: UiPath.CodedWorkflows.LogLevel.Info);
        }
    }
}
