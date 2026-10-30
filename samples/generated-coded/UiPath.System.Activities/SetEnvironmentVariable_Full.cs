using System;
using System.Collections.Generic;
using System.Data;
using System.IO;
using System.Linq;
using UiPath.CodedWorkflows;
using UiPath.Platform.ResourceHandling;

namespace CatalogProbeNet8
{
    // tools/ir/gen-coded.ts で IR（SetEnvironmentVariable_Full）から生成。手で直さず IR を直す
    public class SetEnvironmentVariable_Full : CodedWorkflow
    {
        [Workflow]
        public void Execute()
        {
            String envName = "IRB_ENV_SET_FULL";
            String got = default;
            // 1回目
            System.Environment.SetEnvironmentVariable(envName, "first");
            // 上書き
            System.Environment.SetEnvironmentVariable(envName, "second-" + 2);
            got = System.Environment.GetEnvironmentVariable(envName);
            Log(message: "value=" + got, level: UiPath.CodedWorkflows.LogLevel.Info);
            // 空にして消す
            System.Environment.SetEnvironmentVariable(envName, "");
            got = System.Environment.GetEnvironmentVariable(envName);
            Log(message: "removed=" + String.IsNullOrEmpty(got).ToString(), level: UiPath.CodedWorkflows.LogLevel.Info);
        }
    }
}
