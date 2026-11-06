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
            // InvokeComMethod はCoded API が無い（Coded API なし（ISystemService にも基底クラスにも無い。Type.GetTypeFromProgID と InvokeMember を直接使って書く））ので XAML 経由（coded/_xaml/InvokeComMethod_Full_1.xaml）
            var __xaml1 = RunWorkflow("coded/_xaml/InvokeComMethod_Full_1.xaml", new Dictionary<string, object> { ["res"] = res });
            res = (Object)__xaml1["res"];
            Log(message: Convert.ToString(res.ToString()), level: UiPath.CodedWorkflows.LogLevel.Info);
        }
    }
}
