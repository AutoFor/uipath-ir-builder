using System;
using System.Collections.Generic;
using System.Data;
using System.IO;
using System.Linq;
using UiPath.CodedWorkflows;
using UiPath.Platform.ResourceHandling;

namespace CatalogProbeNet8
{
    // tools/ir/gen-coded.ts で IR（DeleteFolderX_Min）から生成。手で直さず IR を直す
    public class DeleteFolderX_Min : CodedWorkflow
    {
        [Workflow]
        public void Execute()
        {
            Boolean ex = default;
            try
            {
                system.DeleteFileOrFolder(resourceFile: LocalResource.FromPath("output\\DeleteFolderX_Min.d"));
            }
            catch (Exception)
            {
                // ContinueOnError: Delete の例外を無視する
            }
            system.CreateFolder(path: "output\\DeleteFolderX_Min.d");
            system.WriteTextFile(text: "x", file: LocalResource.FromPath("output\\DeleteFolderX_Min.d\\a.txt"));
            ex = system.PathExists(path: "output\\DeleteFolderX_Min.d", pathType: UiPath.Core.Activities.PathType.Folder);
            Log(message: Convert.ToString(ex.ToString()), level: UiPath.CodedWorkflows.LogLevel.Info);
            system.DeleteFileOrFolder(resourceFile: LocalResource.FromPath("output\\DeleteFolderX_Min.d"));
            ex = system.PathExists(path: "output\\DeleteFolderX_Min.d", pathType: UiPath.Core.Activities.PathType.Folder);
            Log(message: Convert.ToString(ex.ToString()), level: UiPath.CodedWorkflows.LogLevel.Info);
        }
    }
}
