using System;
using System.Collections.Generic;
using System.Data;
using System.IO;
using System.Linq;
using UiPath.CodedWorkflows;
using UiPath.Platform.ResourceHandling;

namespace CatalogProbeNet8
{
    // tools/ir/gen-coded.ts で IR（SelectFolder_Min）から生成。手で直さず IR を直す
    public class SelectFolder_Min : CodedWorkflow
    {
        [Workflow]
        public void Execute()
        {
            String d = default;
            // SelectFolder はCoded API が無い（Coded API なし（フォルダー選択ダイアログの API が ISystemService に無い））ので XAML 経由（coded/_xaml/SelectFolder_Min_1.xaml）
            var __xaml1 = RunWorkflow("coded/_xaml/SelectFolder_Min_1.xaml", new Dictionary<string, object> { ["d"] = d });
            d = (String)__xaml1["d"];
            Log(message: "選んだ", level: UiPath.CodedWorkflows.LogLevel.Info);
        }
    }
}
