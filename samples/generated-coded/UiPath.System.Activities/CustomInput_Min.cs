using System;
using System.Collections.Generic;
using System.Data;
using System.IO;
using System.Linq;
using UiPath.CodedWorkflows;
using UiPath.Platform.ResourceHandling;

namespace CatalogProbeNet8
{
    // tools/ir/gen-coded.ts で IR（CustomInput_Min）から生成。手で直さず IR を直す
    public class CustomInput_Min : CodedWorkflow
    {
        [Workflow]
        public void Execute()
        {
            String r = default;
            // CustomInput はCoded API が無い（Coded API なし（HTML の入力ダイアログの API が ISystemService に無い））ので XAML 経由（coded/_activities/CustomInput.xaml）
            var __xaml1 = RunWorkflow("coded/_activities/CustomInput.xaml", new Dictionary<string, object> { ["in_URI"] = "C:\\Users\\Public\\input.html" });
            r = (System.String)__xaml1["out_Result"];
            Log(message: "入力した", level: UiPath.CodedWorkflows.LogLevel.Info);
        }
    }
}
