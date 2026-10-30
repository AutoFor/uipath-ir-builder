using System;
using System.Collections.Generic;
using System.Data;
using System.IO;
using System.Linq;
using UiPath.CodedWorkflows;
using UiPath.Platform.ResourceHandling;

namespace CatalogProbeNet8
{
    // tools/ir/gen-coded.ts で IR（FolderExistsX_Min）から生成。手で直さず IR を直す
    public class FolderExistsX_Min : CodedWorkflow
    {
        [Workflow]
        public void Execute()
        {
            Boolean ex = default;
            system.CreateFolder(path: "output\\FolderExistsX_Min.d");
            ex = system.FolderExists(path: "output\\FolderExistsX_Min.d");
            Log(message: Convert.ToString(ex.ToString()), level: UiPath.CodedWorkflows.LogLevel.Info);
        }
    }
}
