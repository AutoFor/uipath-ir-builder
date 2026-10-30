using System;
using System.Collections.Generic;
using System.Data;
using System.IO;
using System.Linq;
using UiPath.CodedWorkflows;
using UiPath.Platform.ResourceHandling;

namespace CatalogProbeNet8
{
    // tools/ir/gen-coded.ts で IR（StartJob_Var）から生成。手で直さず IR を直す
    public class StartJob_Var : CodedWorkflow
    {
        [Workflow]
        public void Execute()
        {
            Dictionary<String, Object> argsVar = new Dictionary<String, Object>() { { "in_Name", "太郎" } };
            String jobId = default;
            // ジョブを開始（辞書の変数）
            system.StartJob(processName: "IrChildProcess", folderPath: null, jobPriority: UiPath.Orchestrator.Client.Models.StartProcessDtoJobPriority.Normal, resumeOnSameContext: false, jobId: out jobId);
            Log(message: "ジョブを開始した: " + jobId, level: UiPath.CodedWorkflows.LogLevel.Info);
        }
    }
}
