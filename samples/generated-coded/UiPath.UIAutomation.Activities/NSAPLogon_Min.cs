using System;
using System.Collections.Generic;
using System.Data;
using System.IO;
using System.Linq;
using UiPath.CodedWorkflows;
using UiPath.Platform.ResourceHandling;

namespace CatalogProbeNet8
{
    // tools/ir/gen-coded.ts で IR（NSAPLogon_Min）から生成。手で直さず IR を直す
    public class NSAPLogon_Min : CodedWorkflow
    {
        [Workflow]
        public void Execute()
        {
            // SAP Logon
            // NSAPLogon はCoded API が無い（Coded API なし（UiTargetApp に SAPLogon が無い。SAP Logon の起動は uiAutomation.Open で近い動きになるが、別の API なので対応させない））ので XAML 経由（coded/_xaml/NSAPLogon_Min_1.xaml）
            RunWorkflow("coded/_xaml/NSAPLogon_Min_1.xaml", null);
            Log(message: "NSAPLogon 完了", level: UiPath.CodedWorkflows.LogLevel.Info);
        }
    }
}
