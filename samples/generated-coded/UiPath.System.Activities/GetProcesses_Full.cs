using System;
using System.Collections.Generic;
using System.Data;
using System.IO;
using System.Linq;
using UiPath.CodedWorkflows;
using UiPath.Platform.ResourceHandling;
using System.Diagnostics;
using System.Collections.ObjectModel;

namespace CatalogProbeNet8
{
    // tools/ir/gen-coded.ts で IR（GetProcesses_Full）から生成。手で直さず IR を直す
    public class GetProcesses_Full : CodedWorkflow
    {
        [Workflow]
        public void Execute()
        {
            Collection<Process> procs = default;
            // プロセス一覧
            procs = new System.Collections.ObjectModel.Collection<System.Diagnostics.Process>(System.Diagnostics.Process.GetProcesses());
            Log(message: Convert.ToString("self=" + procs.Any(p => p.Id == System.Diagnostics.Process.GetCurrentProcess().Id).ToString()), level: UiPath.CodedWorkflows.LogLevel.Info);
        }
    }
}
