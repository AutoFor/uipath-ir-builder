using System;
using System.Collections.Generic;
using System.Data;
using System.IO;
using System.Linq;
using UiPath.CodedWorkflows;
using UiPath.Platform.ResourceHandling;

namespace CatalogProbeNet8
{
    // tools/ir/gen-coded.ts で IR（InvokePowerShell_Full）から生成。手で直さず IR を直す
    public class InvokePowerShell_Full : CodedWorkflow
    {
        [Workflow]
        public void Execute()
        {
            System.Collections.ObjectModel.Collection<String> res = default;
            // Join-Path を呼ぶ
            // InvokePowerShell はCoded API が無い（Coded API なし（ISystemService にも基底クラスにも無い。System.Management.Automation を直接使って書く））ので XAML 経由（coded/_xaml/InvokePowerShell_Full_1.xaml）
            var __xaml1 = RunWorkflow("coded/_xaml/InvokePowerShell_Full_1.xaml", new Dictionary<string, object> { ["res"] = res });
            res = (System.Collections.ObjectModel.Collection<String>)__xaml1["res"];
            Log(message: res.Count.ToString(), level: UiPath.CodedWorkflows.LogLevel.Info);
            Log(message: Convert.ToString(res[0].ToString()), level: UiPath.CodedWorkflows.LogLevel.Info);
        }
    }
}
