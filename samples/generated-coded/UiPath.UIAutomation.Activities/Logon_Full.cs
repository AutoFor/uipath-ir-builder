using System;
using System.Collections.Generic;
using System.Data;
using System.IO;
using System.Linq;
using UiPath.CodedWorkflows;
using UiPath.Platform.ResourceHandling;

namespace CatalogProbeNet8
{
    // tools/ir/gen-coded.ts で IR（Logon_Full）から生成。手で直さず IR を直す
    public class Logon_Full : CodedWorkflow
    {
        [Workflow]
        public void Execute()
        {
            // Logon はCoded API が無い（Coded API なし（Classic の SAP（非表示の旧アクティビティ）。Coded の uiAutomation が扱うのは Modern のターゲットだけ））ので XAML 経由（coded/_activities/Logon_c5e45f.xaml）
            RunWorkflow("coded/_activities/Logon_c5e45f.xaml", new Dictionary<string, object> { ["in_ConnectionName"] = "SAP-DEV", ["in_ContinueOnError"] = false, ["in_DelayBetweenRetries"] = 1000, ["in_Retries"] = 3, ["in_SAPLogonPath"] = "C:Program Files (x86)SAPFrontEndSAPguisaplogon.exe" });
        }
    }
}
