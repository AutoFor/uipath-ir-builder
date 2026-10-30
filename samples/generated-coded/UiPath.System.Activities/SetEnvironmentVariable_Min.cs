using System;
using System.Collections.Generic;
using System.Data;
using System.IO;
using System.Linq;
using UiPath.CodedWorkflows;
using UiPath.Platform.ResourceHandling;

namespace CatalogProbeNet8
{
    // tools/ir/gen-coded.ts で IR（SetEnvironmentVariable_Min）から生成。手で直さず IR を直す
    public class SetEnvironmentVariable_Min : CodedWorkflow
    {
        [Workflow]
        public void Execute()
        {
            String got = default;
            System.Environment.SetEnvironmentVariable("IRB_ENV_SET_MIN", "min-value");
            got = System.Environment.GetEnvironmentVariable("IRB_ENV_SET_MIN");
            Log(message: "value=" + got, level: UiPath.CodedWorkflows.LogLevel.Info);
        }
    }
}
