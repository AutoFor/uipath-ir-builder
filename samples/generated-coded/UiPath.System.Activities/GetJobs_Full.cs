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
    // tools/ir/gen-coded.ts で IR（GetJobs_Full）から生成。手で直さず IR を直す
    public class GetJobs_Full : CodedWorkflow
    {
        [Workflow]
        public void Execute()
        {
            IEnumerable<OrchestratorJob> jobs = default;
            // 成功したジョブを集める
            jobs = system.GetJobs(filter: "State eq 'Successful'", filterBuilder: null, folderPath: "Shared", top: 10, skip: 0, timeoutMS: 30000);
            Log(message: "ジョブ数: " + jobs.Count().ToString(), level: UiPath.CodedWorkflows.LogLevel.Info);
        }
    }
}
