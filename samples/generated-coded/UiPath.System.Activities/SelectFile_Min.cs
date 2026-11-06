using System;
using System.Collections.Generic;
using System.Data;
using System.IO;
using System.Linq;
using UiPath.CodedWorkflows;
using UiPath.Platform.ResourceHandling;

namespace CatalogProbeNet8
{
    // tools/ir/gen-coded.ts で IR（SelectFile_Min）から生成。手で直さず IR を直す
    public class SelectFile_Min : CodedWorkflow
    {
        [Workflow]
        public void Execute()
        {
            String f = default;
            // SelectFile はCoded API が無い（Coded API なし（ファイル選択ダイアログの API が ISystemService に無い））ので XAML 経由（coded/_xaml/SelectFile_Min_1.xaml）
            var __xaml1 = RunWorkflow("coded/_xaml/SelectFile_Min_1.xaml", new Dictionary<string, object> { ["f"] = f });
            f = (String)__xaml1["f"];
            Log(message: "選んだ", level: UiPath.CodedWorkflows.LogLevel.Info);
        }
    }
}
