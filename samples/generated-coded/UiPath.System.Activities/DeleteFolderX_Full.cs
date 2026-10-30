using System;
using System.Collections.Generic;
using System.Data;
using System.IO;
using System.Linq;
using UiPath.CodedWorkflows;
using UiPath.Platform.ResourceHandling;

namespace CatalogProbeNet8
{
    // tools/ir/gen-coded.ts で IR（DeleteFolderX_Full）から生成。手で直さず IR を直す
    public class DeleteFolderX_Full : CodedWorkflow
    {
        [Workflow]
        public void Execute()
        {
            Boolean ex = default;
            try
            {
                system.DeleteFileOrFolder(resourceFile: LocalResource.FromPath("output\\DeleteFolderX_Full.d"));
            }
            catch (Exception)
            {
                // ContinueOnError: Delete の例外を無視する
            }
            system.CreateFolder(path: "output\\DeleteFolderX_Full.d");
            system.CreateFolder(path: "output\\DeleteFolderX_Full.d\\sub");
            system.WriteTextFile(text: "x", file: LocalResource.FromPath("output\\DeleteFolderX_Full.d\\sub\\a.txt"));
            // 中身ごと消す
            system.DeleteFileOrFolder(resourceFile: LocalResource.FromPath("output\\DeleteFolderX_Full.d"));
            ex = system.PathExists(path: "output\\DeleteFolderX_Full.d", pathType: UiPath.Core.Activities.PathType.Folder);
            Log(message: Convert.ToString(ex.ToString()), level: UiPath.CodedWorkflows.LogLevel.Info);
        }
    }
}
