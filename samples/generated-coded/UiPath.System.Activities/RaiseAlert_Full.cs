using System;
using System.Collections.Generic;
using System.Data;
using System.IO;
using System.Linq;
using UiPath.CodedWorkflows;
using UiPath.Platform.ResourceHandling;

namespace CatalogProbeNet8
{
    // tools/ir/gen-coded.ts で IR（RaiseAlert_Full）から生成。手で直さず IR を直す
    public class RaiseAlert_Full : CodedWorkflow
    {
        [Workflow]
        public void Execute()
        {
            // 警告を上げる
            system.RaiseAlert(severity: UiPath.Core.Activities.AlertSeverity.Warning, notification: "IR テストのアラート（警告）", folderPath: "Shared", timeoutMS: 30000);
            Log(message: "アラートを上げた", level: UiPath.CodedWorkflows.LogLevel.Info);
        }
    }
}
