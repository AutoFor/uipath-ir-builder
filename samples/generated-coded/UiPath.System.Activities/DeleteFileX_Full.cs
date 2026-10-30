using System;
using System.Collections.Generic;
using System.Data;
using System.IO;
using System.Linq;
using UiPath.CodedWorkflows;
using UiPath.Platform.ResourceHandling;

namespace CatalogProbeNet8
{
    // tools/ir/gen-coded.ts で IR（DeleteFileX_Full）から生成。手で直さず IR を直す
    public class DeleteFileX_Full : CodedWorkflow
    {
        [Workflow]
        public void Execute()
        {
            Boolean ex = default;
            system.WriteTextFile(text: "bye", file: LocalResource.FromPath("output\\DeleteFileX_Full.txt"));
            // ファイルを消す
            system.DeleteFileOrFolder(resourceFile: LocalResource.FromPath("output\\DeleteFileX_Full.txt"));
            ex = system.PathExists(path: "output\\DeleteFileX_Full.txt", pathType: UiPath.Core.Activities.PathType.File);
            Log(message: Convert.ToString(ex.ToString()), level: UiPath.CodedWorkflows.LogLevel.Info);
        }
    }
}
