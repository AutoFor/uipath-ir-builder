using System;
using System.Collections.Generic;
using System.Data;
using System.IO;
using System.Linq;
using UiPath.CodedWorkflows;
using UiPath.Platform.ResourceHandling;

namespace CatalogProbeNet8
{
    // tools/ir/gen-coded.ts で IR（CopyFile_Min）から生成。手で直さず IR を直す
    public class CopyFile_Min : CodedWorkflow
    {
        [Workflow]
        public void Execute()
        {
            String txt = default;
            try
            {
                system.DeleteFileOrFolder(resourceFile: LocalResource.FromPath("output\\CopyFile_Min.dst.txt"));
            }
            catch (Exception)
            {
                // ContinueOnError: Delete の例外を無視する
            }
            system.WriteTextFile(text: "copy me", file: LocalResource.FromPath("output\\CopyFile_Min.src.txt"));
            system.CopyFile(path: "output\\CopyFile_Min.src.txt", destination: "output\\CopyFile_Min.dst.txt", overwrite: false);
            txt = system.ReadTextFile(file: LocalResource.FromPath("output\\CopyFile_Min.dst.txt"));
            Log(message: txt, level: UiPath.CodedWorkflows.LogLevel.Info);
        }
    }
}
