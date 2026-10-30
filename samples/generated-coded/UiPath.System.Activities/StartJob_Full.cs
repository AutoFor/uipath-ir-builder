using System;
using System.Collections.Generic;
using System.Data;
using System.IO;
using System.Linq;
using UiPath.CodedWorkflows;
using UiPath.Platform.ResourceHandling;

namespace CatalogProbeNet8
{
    // tools/ir/gen-coded.ts で IR（StartJob_Full）から生成。手で直さず IR を直す
    public class StartJob_Full : CodedWorkflow
    {
        [Workflow]
        public void Execute()
        {
            String jobId = default;
            String jobKey = default;
            // ジョブを開始
            jobKey = system.StartJob(processName: "IrChildProcess", folderPath: "Shared", jobPriority: UiPath.Orchestrator.Client.Models.StartProcessDtoJobPriority.High, resumeOnSameContext: false, jobId: out jobId);
            Log(message: "ジョブを開始した: " + jobKey, level: UiPath.CodedWorkflows.LogLevel.Info);
        }
    }
}
