using System;
using System.Collections.Generic;
using System.Data;
using System.IO;
using System.Linq;
using UiPath.CodedWorkflows;
using UiPath.Platform.ResourceHandling;

namespace CatalogProbeNet8
{
    // tools/ir/gen-coded.ts で IR（Delete_Full）から生成。手で直さず IR を直す
    public class Delete_Full : CodedWorkflow
    {
        [Workflow]
        public void Execute()
        {
            ILocalResource res = default;
            Boolean ex = default;
            res = system.CreateFile(name: "Delete_Full.txt", path: "output");
            // リソースを削除
            system.DeleteFileOrFolder(resourceFile: res);
            ex = system.PathExists(path: "output\\Delete_Full.txt", pathType: UiPath.Core.Activities.PathType.File);
            Log(message: Convert.ToString(ex.ToString()), level: UiPath.CodedWorkflows.LogLevel.Info);
        }
    }
}
