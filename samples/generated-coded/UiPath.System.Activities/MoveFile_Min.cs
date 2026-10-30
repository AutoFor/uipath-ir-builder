using System;
using System.Collections.Generic;
using System.Data;
using System.IO;
using System.Linq;
using UiPath.CodedWorkflows;
using UiPath.Platform.ResourceHandling;

namespace CatalogProbeNet8
{
    // tools/ir/gen-coded.ts で IR（MoveFile_Min）から生成。手で直さず IR を直す
    public class MoveFile_Min : CodedWorkflow
    {
        [Workflow]
        public void Execute()
        {
            String txt = default;
            Boolean srcEx = default;
            try
            {
                system.DeleteFileOrFolder(resourceFile: LocalResource.FromPath("output\\MoveFile_Min.dst.txt"));
            }
            catch (Exception)
            {
                // ContinueOnError: Delete の例外を無視する
            }
            system.WriteTextFile(text: "move me", file: LocalResource.FromPath("output\\MoveFile_Min.src.txt"));
            System.IO.File.Move("output\\MoveFile_Min.src.txt", "output\\MoveFile_Min.dst.txt", false);
            srcEx = system.PathExists(path: "output\\MoveFile_Min.src.txt", pathType: UiPath.Core.Activities.PathType.File);
            txt = system.ReadTextFile(file: LocalResource.FromPath("output\\MoveFile_Min.dst.txt"));
            Log(message: txt, level: UiPath.CodedWorkflows.LogLevel.Info);
            Log(message: Convert.ToString(srcEx.ToString()), level: UiPath.CodedWorkflows.LogLevel.Info);
        }
    }
}
