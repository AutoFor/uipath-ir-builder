using System;
using System.Collections.Generic;
using System.Data;
using System.IO;
using System.Linq;
using UiPath.CodedWorkflows;
using UiPath.Platform.ResourceHandling;

namespace CatalogProbeNet8
{
    // tools/ir/gen-coded.ts で IR（CopyFolderX_Min）から生成。手で直さず IR を直す
    public class CopyFolderX_Min : CodedWorkflow
    {
        [Workflow]
        public void Execute()
        {
            String txt = default;
            try
            {
                system.DeleteFileOrFolder(resourceFile: LocalResource.FromPath("output\\CopyFolderX_Min.src"));
            }
            catch (Exception)
            {
                // ContinueOnError: Delete の例外を無視する
            }
            try
            {
                system.DeleteFileOrFolder(resourceFile: LocalResource.FromPath("output\\CopyFolderX_Min.dst"));
            }
            catch (Exception)
            {
                // ContinueOnError: Delete の例外を無視する
            }
            system.CreateFolder(path: "output\\CopyFolderX_Min.src");
            system.WriteTextFile(text: "copy folder", file: LocalResource.FromPath("output\\CopyFolderX_Min.src\\a.txt"));
            system.CreateFolder(path: "output\\CopyFolderX_Min.dst");
            system.CopyFolder(from: "output\\CopyFolderX_Min.src", to: "output\\CopyFolderX_Min.dst", overwrite: true, includeSubfolder: true);
            txt = system.ReadTextFile(file: LocalResource.FromPath("output\\CopyFolderX_Min.dst\\CopyFolderX_Min.src\\a.txt"));
            Log(message: txt, level: UiPath.CodedWorkflows.LogLevel.Info);
        }
    }
}
