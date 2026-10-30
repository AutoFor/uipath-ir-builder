using System;
using System.Collections.Generic;
using System.Data;
using System.IO;
using System.Linq;
using UiPath.CodedWorkflows;
using UiPath.Platform.ResourceHandling;

namespace CatalogProbeNet8
{
    // tools/ir/gen-coded.ts で IR（CopyFolderX_Resource）から生成。手で直さず IR を直す
    public class CopyFolderX_Resource : CodedWorkflow
    {
        [Workflow]
        public void Execute()
        {
            ILocalResource src = default;
            ILocalResource dst = default;
            String txt = default;
            try
            {
                system.DeleteFileOrFolder(resourceFile: LocalResource.FromPath("output\\CopyFolderX_Resource.src"));
            }
            catch (Exception)
            {
                // ContinueOnError: Delete の例外を無視する
            }
            try
            {
                system.DeleteFileOrFolder(resourceFile: LocalResource.FromPath("output\\CopyFolderX_Resource.dst"));
            }
            catch (Exception)
            {
                // ContinueOnError: Delete の例外を無視する
            }
            system.CreateFolder(path: "output\\CopyFolderX_Resource.src");
            system.WriteTextFile(text: "by resource", file: LocalResource.FromPath("output\\CopyFolderX_Resource.src\\a.txt"));
            system.CreateFolder(path: "output\\CopyFolderX_Resource.dst");
            src = system.PathExists("output\\CopyFolderX_Resource.src", UiPath.Core.Activities.PathType.Folder) ? LocalResource.FromPath("output\\CopyFolderX_Resource.src") : null;
            dst = system.PathExists("output\\CopyFolderX_Resource.dst", UiPath.Core.Activities.PathType.Folder) ? LocalResource.FromPath("output\\CopyFolderX_Resource.dst") : null;
            // リソースでコピー
            system.CopyFolder(from: ((UiPath.Platform.ResourceHandling.ILocalResource)src).LocalPath, to: ((UiPath.Platform.ResourceHandling.ILocalResource)dst).LocalPath, overwrite: true, includeSubfolder: true);
            txt = system.ReadTextFile(file: LocalResource.FromPath("output\\CopyFolderX_Resource.dst\\CopyFolderX_Resource.src\\a.txt"));
            Log(message: txt, level: UiPath.CodedWorkflows.LogLevel.Info);
        }
    }
}
