using System;
using System.Collections.Generic;
using System.Data;
using System.IO;
using System.Linq;
using UiPath.CodedWorkflows;
using UiPath.Platform.ResourceHandling;

namespace CatalogProbeNet8
{
    // tools/ir/gen-coded.ts で IR（CopyFile_Resource）から生成。手で直さず IR を直す
    public class CopyFile_Resource : CodedWorkflow
    {
        [Workflow]
        public void Execute()
        {
            ILocalResource src = default;
            ILocalResource dst = default;
            String txt = default;
            system.WriteTextFile(text: "copy by resource", file: LocalResource.FromPath("output\\CopyFile_Resource.src.txt"));
            system.WriteTextFile(text: "old", file: LocalResource.FromPath("output\\CopyFile_Resource.dst.txt"));
            src = system.PathExists("output\\CopyFile_Resource.src.txt", UiPath.Core.Activities.PathType.File) ? LocalResource.FromPath("output\\CopyFile_Resource.src.txt") : null;
            dst = system.PathExists("output\\CopyFile_Resource.dst.txt", UiPath.Core.Activities.PathType.File) ? LocalResource.FromPath("output\\CopyFile_Resource.dst.txt") : null;
            // リソースでコピー
            system.CopyFile(path: ((UiPath.Platform.ResourceHandling.ILocalResource)src).LocalPath, destination: ((UiPath.Platform.ResourceHandling.ILocalResource)dst).LocalPath, overwrite: true);
            txt = system.ReadTextFile(file: LocalResource.FromPath("output\\CopyFile_Resource.dst.txt"));
            Log(message: txt, level: UiPath.CodedWorkflows.LogLevel.Info);
        }
    }
}
