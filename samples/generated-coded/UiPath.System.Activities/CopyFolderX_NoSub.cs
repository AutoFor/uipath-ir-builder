using System;
using System.Collections.Generic;
using System.Data;
using System.IO;
using System.Linq;
using UiPath.CodedWorkflows;
using UiPath.Platform.ResourceHandling;

namespace CatalogProbeNet8
{
    // tools/ir/gen-coded.ts で IR（CopyFolderX_NoSub）から生成。手で直さず IR を直す
    public class CopyFolderX_NoSub : CodedWorkflow
    {
        [Workflow]
        public void Execute()
        {
            Boolean ex = default;
            String txt = default;
            try
            {
                system.DeleteFileOrFolder(resourceFile: LocalResource.FromPath("output\\CopyFolderX_NoSub.src"));
            }
            catch (Exception)
            {
                // ContinueOnError: Delete の例外を無視する
            }
            try
            {
                system.DeleteFileOrFolder(resourceFile: LocalResource.FromPath("output\\CopyFolderX_NoSub.dst"));
            }
            catch (Exception)
            {
                // ContinueOnError: Delete の例外を無視する
            }
            system.CreateFolder(path: "output\\CopyFolderX_NoSub.src");
            system.CreateFolder(path: "output\\CopyFolderX_NoSub.src\\sub");
            system.WriteTextFile(text: "top", file: LocalResource.FromPath("output\\CopyFolderX_NoSub.src\\a.txt"));
            system.WriteTextFile(text: "sub", file: LocalResource.FromPath("output\\CopyFolderX_NoSub.src\\sub\\b.txt"));
            system.CreateFolder(path: "output\\CopyFolderX_NoSub.dst");
            system.CopyFolder(from: "output\\CopyFolderX_NoSub.src", to: "output\\CopyFolderX_NoSub.dst", overwrite: false, includeSubfolder: false);
            txt = system.ReadTextFile(file: LocalResource.FromPath("output\\CopyFolderX_NoSub.dst\\CopyFolderX_NoSub.src\\a.txt"));
            Log(message: txt, level: UiPath.CodedWorkflows.LogLevel.Info);
            ex = system.PathExists(path: "output\\CopyFolderX_NoSub.dst\\CopyFolderX_NoSub.src\\sub\\b.txt", pathType: UiPath.Core.Activities.PathType.File);
            Log(message: Convert.ToString(ex.ToString()), level: UiPath.CodedWorkflows.LogLevel.Info);
        }
    }
}
