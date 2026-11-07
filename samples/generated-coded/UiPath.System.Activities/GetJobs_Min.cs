using System;
using System.Collections.Generic;
using System.Data;
using System.IO;
using System.Linq;
using UiPath.CodedWorkflows;
using UiPath.Platform.ResourceHandling;
using UiPath.Core.Activities;

namespace CatalogProbeNet8
{
    // tools/ir/gen-coded.ts で IR（GetJobs_Min）から生成。手で直さず IR を直す
    public class GetJobs_Min : CodedWorkflow
    {
        [Workflow]
        public void Execute()
        {
            IEnumerable<UiPath.Core.Activities.OrchestratorJob> jobs = default;
            jobs = system.GetJobs();
            Log(message: "ジョブ数: " + jobs.Count().ToString(), level: UiPath.CodedWorkflows.LogLevel.Info);
        }
    }
}
