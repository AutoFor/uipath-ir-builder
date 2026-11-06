using System;
using System.Collections.Generic;
using System.Data;
using System.IO;
using System.Linq;
using UiPath.CodedWorkflows;
using UiPath.Platform.ResourceHandling;

namespace CatalogProbeNet8
{
    // tools/ir/gen-coded.ts で IR（InvokeComMethod_Full）から生成。手で直さず IR を直す
    public class InvokeComMethod_Full : CodedWorkflow
    {
        [Workflow]
        public void Execute()
        {
            Object res = default;
            // CLSID で呼ぶ
            // InvokeComMethod はCoded API が無い（Coded API なし（ISystemService にも基底クラスにも無い。Type.GetTypeFromProgID と InvokeMember を直接使って書く））ので XAML 経由（coded/_activities/InvokeComMethod_36bfb5.xaml）
            var __xaml1 = RunWorkflow("coded/_activities/InvokeComMethod_36bfb5.xaml", new Dictionary<string, object> { ["in_CLSID"] = "{0D43FE01-F093-11CF-8940-00A0C9054228}", ["in_ContinueOnError"] = false, ["in_MethodName"] = "GetExtensionName", ["in_Arguments_path"] = "C:/dir/sample.txt" });
            res = (System.Object)__xaml1["out_Result"];
            Log(message: Convert.ToString(res.ToString()), level: UiPath.CodedWorkflows.LogLevel.Info);
        }
    }
}
