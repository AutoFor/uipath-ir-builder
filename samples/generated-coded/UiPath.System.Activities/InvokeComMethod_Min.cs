using System;
using System.Collections.Generic;
using System.Data;
using System.IO;
using System.Linq;
using UiPath.CodedWorkflows;
using UiPath.Platform.ResourceHandling;

namespace CatalogProbeNet8
{
    // tools/ir/gen-coded.ts で IR（InvokeComMethod_Min）から生成。手で直さず IR を直す
    public class InvokeComMethod_Min : CodedWorkflow
    {
        [Workflow]
        public void Execute()
        {
            Object res = default;
            // InvokeComMethod はCoded API が無い（Coded API なし（ISystemService にも基底クラスにも無い。Type.GetTypeFromProgID と InvokeMember を直接使って書く））ので XAML 経由（coded/_activities/InvokeComMethod_a44a1c.xaml）
            var __xaml1 = RunWorkflow("coded/_activities/InvokeComMethod_a44a1c.xaml", new Dictionary<string, object> { ["in_MethodName"] = "GetBaseName", ["in_ProgID"] = "Scripting.FileSystemObject", ["in_Arguments_path"] = "C:/dir/sample.txt" });
            res = (System.Object)__xaml1["out_Result"];
            Log(message: Convert.ToString(res.ToString()), level: UiPath.CodedWorkflows.LogLevel.Info);
        }
    }
}
