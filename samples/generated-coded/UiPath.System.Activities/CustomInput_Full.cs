using System;
using System.Collections.Generic;
using System.Data;
using System.IO;
using System.Linq;
using UiPath.CodedWorkflows;
using UiPath.Platform.ResourceHandling;

namespace CatalogProbeNet8
{
    // tools/ir/gen-coded.ts で IR（CustomInput_Full）から生成。手で直さず IR を直す
    public class CustomInput_Full : CodedWorkflow
    {
        [Workflow]
        public void Execute()
        {
            String r = default;
            // 独自の入力画面
            // CustomInput はCoded API が無い（Coded API なし（HTML の入力ダイアログの API が ISystemService に無い））ので XAML 経由（coded/_xaml/CustomInput_Full_1.xaml）
            var __xaml1 = RunWorkflow("coded/_xaml/CustomInput_Full_1.xaml", new Dictionary<string, object> { ["r"] = r });
            r = (String)__xaml1["r"];
            Log(message: "入力した", level: UiPath.CodedWorkflows.LogLevel.Info);
        }
    }
}
