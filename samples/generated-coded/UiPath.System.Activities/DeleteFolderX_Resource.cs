using System;
using System.Collections.Generic;
using System.Data;
using System.IO;
using System.Linq;
using UiPath.CodedWorkflows;
using UiPath.Platform.ResourceHandling;

namespace CatalogProbeNet8
{
    // tools/ir/gen-coded.ts で IR（DeleteFolderX_Resource）から生成。手で直さず IR を直す
    public class DeleteFolderX_Resource : CodedWorkflow
    {
        [Workflow]
        public void Execute()
        {
            Boolean ex = default;
            ILocalResource res = default;
            try
            {
                system.DeleteFileOrFolder(resourceFile: LocalResource.FromPath("output\\DeleteFolderX_Resource.d"));
            }
            catch (Exception)
            {
                // ContinueOnError: Delete の例外を無視する
            }
            system.CreateFolder(path: "output\\DeleteFolderX_Resource.d");
            system.WriteTextFile(text: "x", file: LocalResource.FromPath("output\\DeleteFolderX_Resource.d\\a.txt"));
            res = system.PathExists("output\\DeleteFolderX_Resource.d", UiPath.Core.Activities.PathType.Folder) ? LocalResource.FromPath("output\\DeleteFolderX_Resource.d") : null;
            // リソースで消す
            system.DeleteFileOrFolder(resourceFile: (UiPath.Platform.ResourceHandling.ILocalResource)res);
            ex = system.PathExists(path: "output\\DeleteFolderX_Resource.d", pathType: UiPath.Core.Activities.PathType.Folder);
            Log(message: Convert.ToString(ex.ToString()), level: UiPath.CodedWorkflows.LogLevel.Info);
        }
    }
}
