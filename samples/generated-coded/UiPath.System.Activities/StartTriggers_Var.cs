using System;
using System.Collections.Generic;
using System.Data;
using System.IO;
using System.Linq;
using UiPath.CodedWorkflows;
using UiPath.Platform.ResourceHandling;

namespace CatalogProbeNet8
{
    // tools/ir/gen-coded.ts で IR（StartTriggers_Var）から生成。手で直さず IR を直す
    public class StartTriggers_Var : CodedWorkflow
    {
        [Workflow]
        public void Execute()
        {
            Dictionary<String, Object> av = new Dictionary<String, Object>() { { "in_Name", "三郎" } };
            // StartTriggers はCoded API が無い（Coded API なし（トリガーは ISystemService に無い））ので XAML 経由（coded/_xaml/StartTriggers_Var_1.xaml）
            RunWorkflow("coded/_xaml/StartTriggers_Var_1.xaml", new Dictionary<string, object> { ["av"] = av });
            Log(message: "開始した", level: UiPath.CodedWorkflows.LogLevel.Info);
        }
    }
}
