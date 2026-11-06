using System;
using System.Collections.Generic;
using System.Data;
using System.IO;
using System.Linq;
using UiPath.CodedWorkflows;
using UiPath.Platform.ResourceHandling;

namespace CatalogProbeNet8
{
    // tools/ir/gen-coded.ts で IR（InputDialog_Full）から生成。手で直さず IR を直す
    public class InputDialog_Full : CodedWorkflow
    {
        [Workflow]
        public void Execute()
        {
            String r = default;
            // 入力ダイアログ
            // InputDialog はCoded API が無い（Coded API なし（入力ダイアログの API が ISystemService に無い））ので XAML 経由（coded/_activities/InputDialog_b33c0e.xaml）
            var __xaml1 = RunWorkflow("coded/_activities/InputDialog_b33c0e.xaml", new Dictionary<string, object> { ["in_Label"] = "選んでください", ["in_Options"] = new String[] { "A", "B", "C" }, ["in_Title"] = "確認", ["in_TopMost"] = true });
            r = (String)__xaml1["out_Result"];
            Log(message: "入力した", level: UiPath.CodedWorkflows.LogLevel.Info);
        }
    }
}
