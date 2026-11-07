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
    // tools/ir/gen-coded.ts で IR（RunJob_Min）から生成。手で直さず IR を直す
    public class RunJob_Min : CodedWorkflow
    {
        [Workflow]
        public void Execute()
        {
            UiPath.Core.Activities.OrchestratorJob job = default;
            (job, _) = system.RunJob(processName: "IrChildProcess", orchestratorFolderPath: null, inputArguments: null, doNotWait: false, runJobOptionalParameters: new UiPath.Activities.System.Jobs.Coded.RunJobOptionalParameters { TimeoutMS = 600000, FailWhenJobFails = true, Priority = UiPath.Activities.System.Jobs.JobPriorityV2.Inherited, EntryPointPath = null, RuntimeType = UiPath.Activities.System.Jobs.JobRuntimeType.Default, Machine = null, Account = null });
            Log(message: "ジョブを実行した", level: UiPath.CodedWorkflows.LogLevel.Info);
        }
    }
}
