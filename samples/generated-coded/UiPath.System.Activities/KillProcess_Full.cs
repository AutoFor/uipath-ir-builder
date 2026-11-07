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
    // tools/ir/gen-coded.ts で IR（KillProcess_Full）から生成。手で直さず IR を直す
    public class KillProcess_Full : CodedWorkflow
    {
        [Workflow]
        public void Execute()
        {
            FileInfo copy = default;
            System.Diagnostics.Process sleeper = default;
            // ping を別名でコピー
            copy = new System.IO.FileInfo("C:/Windows/System32/PING.EXE").CopyTo(System.IO.Path.Combine(System.IO.Path.GetTempPath(), "irb_sleeper.exe"), true);
            // コピーを起動
            sleeper = System.Diagnostics.Process.Start(new System.Diagnostics.ProcessStartInfo(copy.FullName, "-n 60 127.0.0.1") { UseShellExecute = false, CreateNoWindow = true });
            Log(message: "running=" + System.Diagnostics.Process.GetProcessesByName("irb_sleeper").Length.ToString(), level: UiPath.CodedWorkflows.LogLevel.Info);
            // 名前で止める
            foreach (var p in System.Diagnostics.Process.GetProcessesByName("irb_sleeper")) { p.Kill(); }
            Log(message: "exited=" + sleeper.WaitForExit(5000).ToString(), level: UiPath.CodedWorkflows.LogLevel.Info);
        }
    }
}
