using System;
using System.Collections.Generic;
using System.Data;
using System.IO;
using System.Linq;
using UiPath.CodedWorkflows;
using UiPath.Platform.ResourceHandling;

namespace CatalogProbeNet8
{
    // tools/ir/gen-coded.ts で IR（InvokeVBScript_Full）から生成。手で直さず IR を直す
    public class InvokeVBScript_Full : CodedWorkflow
    {
        [Workflow]
        public void Execute()
        {
            String outText = default;
            // スクリプトを書く
            system.WriteTextFile(text: "WScript.Echo WScript.Arguments(0) & \"-\" & WScript.Arguments(1)", file: LocalResource.FromPath(System.IO.Path.Combine(System.IO.Path.GetTempPath(), "irb-vbs-full.vbs")));
            // 引数つきで呼ぶ
            // InvokeVBScript はCoded API が無い（Coded API なし（ISystemService にも基底クラスにも無い。cscript を System.Diagnostics.Process で起動して書く））ので XAML 経由（coded/_xaml/InvokeVBScript_Full_1.xaml）
            var __xaml1 = RunWorkflow("coded/_xaml/InvokeVBScript_Full_1.xaml", new Dictionary<string, object> { ["outText"] = outText });
            outText = (String)__xaml1["outText"];
            Log(message: Convert.ToString(outText.Trim()), level: UiPath.CodedWorkflows.LogLevel.Info);
        }
    }
}
