using System;
using System.Collections.Generic;
using System.Data;
using System.IO;
using System.Linq;
using UiPath.CodedWorkflows;
using UiPath.Platform.ResourceHandling;

namespace CatalogProbeNet8
{
    // tools/ir/gen-coded.ts で IR（InvokeProcess_Opts）から生成。手で直さず IR を直す
    public class InvokeProcess_Opts : CodedWorkflow
    {
        [Workflow]
        public void Execute()
        {
            // 引数なしで呼ぶ
            system.InvokeProcess(processName: "IrbSampleProcess", folderPath: "Shared", entryPointPath: "Main.xaml", targetSession: UiPath.Core.Activities.InvokeProcessTargetSession.Current, logEntry: UiPath.Core.Activities.LogEntryType.OnlyInvocation, logExit: UiPath.Core.Activities.LogExitType.OnlySuccessfulReturn, level: UiPath.Core.Activities.LogLevel.Info, usePackage: true, timeout: TimeSpan.FromMinutes(5));
        }
    }
}
