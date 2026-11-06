using System;
using System.Collections.Generic;
using System.Data;
using System.IO;
using System.Linq;
using UiPath.CodedWorkflows;
using UiPath.Platform.ResourceHandling;

namespace CatalogProbeNet8
{
    // tools/ir/gen-coded.ts で IR（InvokeVBScript_Min）から生成。手で直さず IR を直す
    public class InvokeVBScript_Min : CodedWorkflow
    {
        [Workflow]
        public void Execute()
        {
            String outText = default;
            system.WriteTextFile(text: "WScript.Echo \"hello from vbs\"", file: LocalResource.FromPath(System.IO.Path.Combine(System.IO.Path.GetTempPath(), "irb-vbs-min.vbs")));
            // InvokeVBScript はCoded API が無い（Coded API なし（ISystemService にも基底クラスにも無い。cscript を System.Diagnostics.Process で起動して書く））ので XAML 経由（coded/_activities/InvokeVBScript_651fda.xaml）
            var __xaml1 = RunWorkflow("coded/_activities/InvokeVBScript_651fda.xaml", new Dictionary<string, object> { ["in_FileName"] = Convert.ToString(System.IO.Path.Combine(System.IO.Path.GetTempPath(), "irb-vbs-min.vbs")) });
            outText = (System.String)__xaml1["out_Result"];
            Log(message: Convert.ToString(outText.Trim()), level: UiPath.CodedWorkflows.LogLevel.Info);
        }
    }
}
