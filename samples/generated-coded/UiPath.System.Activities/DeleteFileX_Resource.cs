using System;
using System.Collections.Generic;
using System.Data;
using System.IO;
using System.Linq;
using UiPath.CodedWorkflows;
using UiPath.Platform.ResourceHandling;

namespace CatalogProbeNet8
{
    // tools/ir/gen-coded.ts で IR（DeleteFileX_Resource）から生成。手で直さず IR を直す
    public class DeleteFileX_Resource : CodedWorkflow
    {
        [Workflow]
        public void Execute()
        {
            Boolean ex = default;
            ILocalResource res = default;
            system.WriteTextFile(text: "bye", file: LocalResource.FromPath("output\\DeleteFileX_Resource.txt"));
            res = system.PathExists("output\\DeleteFileX_Resource.txt", UiPath.Core.Activities.PathType.File) ? LocalResource.FromPath("output\\DeleteFileX_Resource.txt") : null;
            // リソースで消す
            system.DeleteFileOrFolder(resourceFile: (UiPath.Platform.ResourceHandling.ILocalResource)res);
            ex = system.PathExists(path: "output\\DeleteFileX_Resource.txt", pathType: UiPath.Core.Activities.PathType.File);
            Log(message: Convert.ToString(ex.ToString()), level: UiPath.CodedWorkflows.LogLevel.Info);
        }
    }
}
