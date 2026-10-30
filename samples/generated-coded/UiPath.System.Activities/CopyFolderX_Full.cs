using System;
using System.Collections.Generic;
using System.Data;
using System.IO;
using System.Linq;
using UiPath.CodedWorkflows;
using UiPath.Platform.ResourceHandling;

namespace CatalogProbeNet8
{
    // tools/ir/gen-coded.ts で IR（CopyFolderX_Full）から生成。手で直さず IR を直す
    public class CopyFolderX_Full : CodedWorkflow
    {
        [Workflow]
        public void Execute()
        {
            Boolean ex = default;
            String txt = default;
            try
            {
                system.DeleteFileOrFolder(resourceFile: LocalResource.FromPath("output\\CopyFolderX_Full.src"));
            }
            catch (Exception)
            {
                // ContinueOnError: Delete の例外を無視する
            }
            try
            {
                system.DeleteFileOrFolder(resourceFile: LocalResource.FromPath("output\\CopyFolderX_Full.dst"));
            }
            catch (Exception)
            {
                // ContinueOnError: Delete の例外を無視する
            }
            system.CreateFolder(path: "output\\CopyFolderX_Full.src");
            system.CreateFolder(path: "output\\CopyFolderX_Full.src\\sub");
            system.WriteTextFile(text: "new", file: LocalResource.FromPath("output\\CopyFolderX_Full.src\\a.txt"));
            system.WriteTextFile(text: "sub", file: LocalResource.FromPath("output\\CopyFolderX_Full.src\\sub\\b.txt"));
            system.CreateFolder(path: "output\\CopyFolderX_Full.dst");
            system.CreateFolder(path: "output\\CopyFolderX_Full.dst\\CopyFolderX_Full.src");
            system.WriteTextFile(text: "old", file: LocalResource.FromPath("output\\CopyFolderX_Full.dst\\CopyFolderX_Full.src\\a.txt"));
            // サブフォルダごと上書きコピー
            system.CopyFolder(from: "output\\CopyFolderX_Full.src", to: "output\\CopyFolderX_Full.dst", overwrite: true, includeSubfolder: true);
            txt = system.ReadTextFile(file: LocalResource.FromPath("output\\CopyFolderX_Full.dst\\CopyFolderX_Full.src\\a.txt"));
            Log(message: txt, level: UiPath.CodedWorkflows.LogLevel.Info);
            ex = system.PathExists(path: "output\\CopyFolderX_Full.dst\\CopyFolderX_Full.src\\sub\\b.txt", pathType: UiPath.Core.Activities.PathType.File);
            Log(message: Convert.ToString(ex.ToString()), level: UiPath.CodedWorkflows.LogLevel.Info);
        }
    }
}
