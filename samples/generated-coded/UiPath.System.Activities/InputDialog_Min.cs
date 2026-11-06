using System;
using System.Collections.Generic;
using System.Data;
using System.IO;
using System.Linq;
using UiPath.CodedWorkflows;
using UiPath.Platform.ResourceHandling;

namespace CatalogProbeNet8
{
    // tools/ir/gen-coded.ts で IR（InputDialog_Min）から生成。手で直さず IR を直す
    public class InputDialog_Min : CodedWorkflow
    {
        [Workflow]
        public void Execute()
        {
            String r = default;
            // InputDialog はCoded API が無い（Coded API なし（入力ダイアログの API が ISystemService に無い））ので XAML 経由（coded/_activities/InputDialog_15b01c.xaml）
            var __xaml1 = RunWorkflow("coded/_activities/InputDialog_15b01c.xaml", null);
            r = (String)__xaml1["out_Result"];
            Log(message: "入力した", level: UiPath.CodedWorkflows.LogLevel.Info);
        }
    }
}
