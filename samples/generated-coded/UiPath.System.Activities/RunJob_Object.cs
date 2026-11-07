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
    // tools/ir/gen-coded.ts で IR（RunJob_Object）から生成。手で直さず IR を直す
    public class RunJob_Object : CodedWorkflow
    {
        [Workflow]
        public void Execute()
        {
            String inp = "{\"Name\":\"太郎\"}";
            String outp = default;
            UiPath.Core.Activities.OrchestratorJob job = default;
            // 子のプロセスを実行（オブジェクト）
            (job, outp) = system.RunJob(processName: "IrChildProcess", orchestratorFolderPath: null, inputArguments: inp, doNotWait: false, runJobOptionalParameters: new UiPath.Activities.System.Jobs.Coded.RunJobOptionalParameters { TimeoutMS = 600000, FailWhenJobFails = true, Priority = UiPath.Activities.System.Jobs.JobPriorityV2.Inherited, EntryPointPath = null, RuntimeType = UiPath.Activities.System.Jobs.JobRuntimeType.Default, Machine = null, Account = null });
            Log(message: "出力: " + outp, level: UiPath.CodedWorkflows.LogLevel.Info);
        }
    }
}
