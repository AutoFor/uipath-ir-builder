using System;
using System.Collections.Generic;
using System.Data;
using System.IO;
using System.Linq;
using UiPath.CodedWorkflows;
using UiPath.Platform.ResourceHandling;

namespace CatalogProbeNet8
{
    // tools/ir/gen-coded.ts で IR（StartJob_Min）から生成。手で直さず IR を直す
    public class StartJob_Min : CodedWorkflow
    {
        [Workflow]
        public void Execute()
        {
            system.StartJob(processName: "IrChildProcess", folderPath: null, jobPriority: UiPath.Orchestrator.Client.Models.StartProcessDtoJobPriority.Normal, resumeOnSameContext: false, jobId: out _);
            Log(message: "ジョブを開始した", level: UiPath.CodedWorkflows.LogLevel.Info);
        }
    }
}
