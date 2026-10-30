using System;
using System.Collections.Generic;
using System.Data;
using System.IO;
using System.Linq;
using UiPath.CodedWorkflows;
using UiPath.Platform.ResourceHandling;

namespace CatalogProbeNet8
{
    // tools/ir/gen-coded.ts で IR（Delete_Min）から生成。手で直さず IR を直す
    public class Delete_Min : CodedWorkflow
    {
        [Workflow]
        public void Execute()
        {
            Boolean ex = default;
            system.WriteTextFile(text: "bye", file: LocalResource.FromPath("output\\Delete_Min.txt"));
            system.DeleteFileOrFolder(resourceFile: LocalResource.FromPath("output\\Delete_Min.txt"));
            ex = system.PathExists(path: "output\\Delete_Min.txt", pathType: UiPath.Core.Activities.PathType.File);
            Log(message: Convert.ToString(ex.ToString()), level: UiPath.CodedWorkflows.LogLevel.Info);
        }
    }
}
