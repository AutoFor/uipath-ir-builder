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
    // tools/ir/gen-coded.ts で IR（RunJob_Full）から生成。手で直さず IR を直す
    public class RunJob_Full : CodedWorkflow
    {
        [Workflow]
        public void Execute()
        {
            UiPath.Core.Activities.OrchestratorJob job = default;
            // 子のプロセスを実行
            (job, _) = system.RunJob(processName: "IrChildProcess", orchestratorFolderPath: "Shared", inputArguments: new Dictionary<string, object> { ["in_Name"] = "太郎" }, doNotWait: false, runJobOptionalParameters: new UiPath.Activities.System.Jobs.Coded.RunJobOptionalParameters { TimeoutMS = 600000, FailWhenJobFails = false, Priority = UiPath.Activities.System.Jobs.JobPriorityV2.High, EntryPointPath = "Main.xaml", RuntimeType = UiPath.Activities.System.Jobs.JobRuntimeType.Unattended, Machine = "ir-machine", Account = "ir-robot-unattended" });
            Log(message: "ジョブを実行した", level: UiPath.CodedWorkflows.LogLevel.Info);
        }
    }
}
