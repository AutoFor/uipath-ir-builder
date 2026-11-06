using System;
using System.Collections.Generic;
using System.Data;
using System.IO;
using System.Linq;
using UiPath.CodedWorkflows;
using UiPath.Platform.ResourceHandling;

namespace CatalogProbeNet8
{
    // tools/ir/gen-coded.ts で IR（IsMatch_Min）から生成。手で直さず IR を直す
    public class IsMatch_Min : CodedWorkflow
    {
        [Workflow]
        public void Execute()
        {
            Boolean ok = default;
            Boolean ng = default;
            // IsMatch はCoded API が無い（Coded API なし（ISystemService に IsMatch が無い。正規表現は System.Text.RegularExpressions.Regex で書ける））ので XAML 経由（coded/_xaml/IsMatch_Min_1.xaml）
            var __xaml1 = RunWorkflow("coded/_xaml/IsMatch_Min_1.xaml", new Dictionary<string, object> { ["ok"] = ok });
            ok = (Boolean)__xaml1["ok"];
            // IsMatch はCoded API が無い（Coded API なし（ISystemService に IsMatch が無い。正規表現は System.Text.RegularExpressions.Regex で書ける））ので XAML 経由（coded/_xaml/IsMatch_Min_2.xaml）
            var __xaml2 = RunWorkflow("coded/_xaml/IsMatch_Min_2.xaml", new Dictionary<string, object> { ["ng"] = ng });
            ng = (Boolean)__xaml2["ng"];
            Log(message: ok.ToString(), level: UiPath.CodedWorkflows.LogLevel.Info);
            Log(message: ng.ToString(), level: UiPath.CodedWorkflows.LogLevel.Info);
        }
    }
}
