using System;
using System.Collections.Generic;
using System.Data;
using System.IO;
using System.Linq;
using UiPath.CodedWorkflows;
using UiPath.Platform.ResourceHandling;

namespace CatalogProbeNet8
{
    // tools/ir/gen-coded.ts で IR（ToUpperLowerTextModification_Full）から生成。手で直さず IR を直す
    public class ToUpperLowerTextModification_Full : CodedWorkflow
    {
        [Workflow]
        public void Execute()
        {
            String a = default;
            String b = default;
            // 小文字にする
            // ModifyText はCoded API が無い（Coded API なし（ISystemService に該当するメソッドが無い。個々の加工は ChangeCase / FindAndReplace などで書き分ける））ので XAML 経由（coded/_xaml/ToUpperLowerTextModification_Full_1.xaml）
            var __xaml1 = RunWorkflow("coded/_xaml/ToUpperLowerTextModification_Full_1.xaml", new Dictionary<string, object> { ["a"] = a });
            a = (String)__xaml1["a"];
            // 大文字にする
            // ModifyText はCoded API が無い（Coded API なし（ISystemService に該当するメソッドが無い。個々の加工は ChangeCase / FindAndReplace などで書き分ける））ので XAML 経由（coded/_xaml/ToUpperLowerTextModification_Full_2.xaml）
            var __xaml2 = RunWorkflow("coded/_xaml/ToUpperLowerTextModification_Full_2.xaml", new Dictionary<string, object> { ["b"] = b });
            b = (String)__xaml2["b"];
            Log(message: a, level: UiPath.CodedWorkflows.LogLevel.Info);
            Log(message: b, level: UiPath.CodedWorkflows.LogLevel.Info);
        }
    }
}
