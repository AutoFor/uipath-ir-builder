using System;
using System.Collections.Generic;
using System.Data;
using System.IO;
using System.Linq;
using UiPath.CodedWorkflows;
using UiPath.Platform.ResourceHandling;

namespace CatalogProbeNet8
{
    // tools/ir/gen-coded.ts で IR（GetEnvironmentVariable_Full）から生成。手で直さず IR を直す
    public class GetEnvironmentVariable_Full : CodedWorkflow
    {
        [Workflow]
        public void Execute()
        {
            String val = default;
            String name = "IRB_ENV_GET_FULL";
            System.Environment.SetEnvironmentVariable(name, "abc");
            // 設定した値を読む
            val = System.Environment.GetEnvironmentVariable(name);
            Log(message: "found=" + val, level: UiPath.CodedWorkflows.LogLevel.Info);
            // 無い変数を読む
            val = System.Environment.GetEnvironmentVariable("IRB_ENV_NOT_SET");
            Log(message: "missing=" + String.IsNullOrEmpty(val).ToString(), level: UiPath.CodedWorkflows.LogLevel.Info);
        }
    }
}
