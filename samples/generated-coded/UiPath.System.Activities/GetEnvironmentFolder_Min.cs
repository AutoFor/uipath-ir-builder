using System;
using System.Collections.Generic;
using System.Data;
using System.IO;
using System.Linq;
using UiPath.CodedWorkflows;
using UiPath.Platform.ResourceHandling;

namespace CatalogProbeNet8
{
    // tools/ir/gen-coded.ts で IR（GetEnvironmentFolder_Min）から生成。手で直さず IR を直す
    public class GetEnvironmentFolder_Min : CodedWorkflow
    {
        [Workflow]
        public void Execute()
        {
            String folder = default;
            folder = System.Environment.GetFolderPath(System.Environment.SpecialFolder.Desktop);
            Log(message: Convert.ToString(System.IO.Path.GetFileName(folder)), level: UiPath.CodedWorkflows.LogLevel.Info);
        }
    }
}
