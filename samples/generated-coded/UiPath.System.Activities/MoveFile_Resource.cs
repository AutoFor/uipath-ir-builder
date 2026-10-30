using System;
using System.Collections.Generic;
using System.Data;
using System.IO;
using System.Linq;
using UiPath.CodedWorkflows;
using UiPath.Platform.ResourceHandling;

namespace CatalogProbeNet8
{
    // tools/ir/gen-coded.ts で IR（MoveFile_Resource）から生成。手で直さず IR を直す
    public class MoveFile_Resource : CodedWorkflow
    {
        [Workflow]
        public void Execute()
        {
            ILocalResource src = default;
            ILocalResource dst = default;
            String txt = default;
            system.WriteTextFile(text: "move by resource", file: LocalResource.FromPath("output\\MoveFile_Resource.src.txt"));
            system.CreateFolder(path: "output\\MoveFile_Resource.dir");
            system.WriteTextFile(text: "old", file: LocalResource.FromPath("output\\MoveFile_Resource.dir\\MoveFile_Resource.src.txt"));
            src = system.PathExists("output\\MoveFile_Resource.src.txt", UiPath.Core.Activities.PathType.File) ? LocalResource.FromPath("output\\MoveFile_Resource.src.txt") : null;
            dst = system.PathExists("output\\MoveFile_Resource.dir", UiPath.Core.Activities.PathType.Folder) ? LocalResource.FromPath("output\\MoveFile_Resource.dir") : null;
            // リソースでフォルダーへ移動
            system.MoveFile(pathResource: src, destinationResource: dst, overwrite: true);
            txt = system.ReadTextFile(file: LocalResource.FromPath("output\\MoveFile_Resource.dir\\MoveFile_Resource.src.txt"));
            Log(message: txt, level: UiPath.CodedWorkflows.LogLevel.Info);
        }
    }
}
