using System;
using System.Collections.Generic;
using System.Data;
using System.IO;
using System.Linq;
using UiPath.CodedWorkflows;
using UiPath.Platform.ResourceHandling;

namespace CatalogProbeNet8
{
    // tools/ir/gen-coded.ts で IR（RaiseAlert_Min）から生成。手で直さず IR を直す
    public class RaiseAlert_Min : CodedWorkflow
    {
        [Workflow]
        public void Execute()
        {
            system.RaiseAlert(severity: UiPath.Core.Activities.AlertSeverity.Info, notification: "IR テストのアラート");
            Log(message: "アラートを上げた", level: UiPath.CodedWorkflows.LogLevel.Info);
        }
    }
}
