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
    // tools/ir/gen-coded.ts で IR（GetProcesses_Min）から生成。手で直さず IR を直す
    public class GetProcesses_Min : CodedWorkflow
    {
        [Workflow]
        public void Execute()
        {
            Collection<Process> procs = default;
            procs = new System.Collections.ObjectModel.Collection<System.Diagnostics.Process>(System.Diagnostics.Process.GetProcesses());
            Log(message: "any=" + (procs.Count > 0).ToString(), level: UiPath.CodedWorkflows.LogLevel.Info);
        }
    }
}
