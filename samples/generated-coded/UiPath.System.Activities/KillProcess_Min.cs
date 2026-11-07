using System;
using System.Collections.Generic;
using System.Data;
using System.IO;
using System.Linq;
using UiPath.CodedWorkflows;
using UiPath.Platform.ResourceHandling;
using System.Diagnostics;

namespace CatalogProbeNet8
{
    // tools/ir/gen-coded.ts で IR（KillProcess_Min）から生成。手で直さず IR を直す
    public class KillProcess_Min : CodedWorkflow
    {
        [Workflow]
        public void Execute()
        {
            System.Diagnostics.Process sleeper = default;
            // ping を起動
            sleeper = System.Diagnostics.Process.Start(new System.Diagnostics.ProcessStartInfo("ping.exe", "-n 60 127.0.0.1") { UseShellExecute = false, CreateNoWindow = true });
            sleeper.Kill();
            Log(message: "exited=" + sleeper.WaitForExit(5000).ToString(), level: UiPath.CodedWorkflows.LogLevel.Info);
        }
    }
}
