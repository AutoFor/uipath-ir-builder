using System;
using System.Collections.Generic;
using System.Data;
using System.IO;
using System.Linq;
using UiPath.CodedWorkflows;
using UiPath.Platform.ResourceHandling;

namespace CatalogProbeNet8
{
    // tools/ir/gen-coded.ts で IR（FileExistsX_Min）から生成。手で直さず IR を直す
    public class FileExistsX_Min : CodedWorkflow
    {
        [Workflow]
        public void Execute()
        {
            Boolean ex = default;
            system.WriteTextFile(text: "hi", file: LocalResource.FromPath("output\\FileExistsX_Min.txt"));
            ex = system.FileExists(path: "output\\FileExistsX_Min.txt");
            Log(message: Convert.ToString(ex.ToString()), level: UiPath.CodedWorkflows.LogLevel.Info);
        }
    }
}
