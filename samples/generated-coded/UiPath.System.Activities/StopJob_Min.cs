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
    // tools/ir/gen-coded.ts で IR（StopJob_Min）から生成。手で直さず IR を直す
    public class StopJob_Min : CodedWorkflow
    {
        [Workflow]
        public void Execute()
        {
            UiPath.Core.Activities.OrchestratorJob job = default;
            system.StopJob(job: job, strategy: UiPath.Core.Activities.StopStrategy.Stop);
            Log(message: "ジョブを止めた", level: UiPath.CodedWorkflows.LogLevel.Info);
        }
    }
}
