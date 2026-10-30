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
    // tools/ir/gen-coded.ts で IR（StopJob_Full）から生成。手で直さず IR を直す
    public class StopJob_Full : CodedWorkflow
    {
        [Workflow]
        public void Execute()
        {
            OrchestratorJob job = default;
            // ジョブを止める
            system.StopJob(job: job, strategy: UiPath.Core.Activities.StopStrategy.Kill, folderPath: null, timeoutMS: 30000);
            Log(message: "ジョブを止めた", level: UiPath.CodedWorkflows.LogLevel.Info);
        }
    }
}
