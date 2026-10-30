using System;
using System.Collections.Generic;
using System.Data;
using System.IO;
using System.Linq;
using UiPath.CodedWorkflows;
using UiPath.Platform.ResourceHandling;

namespace CatalogProbeNet8
{
    // tools/ir/gen-coded.ts で IR（CopyFile_Full）から生成。手で直さず IR を直す
    public class CopyFile_Full : CodedWorkflow
    {
        [Workflow]
        public void Execute()
        {
            String txt = default;
            system.WriteTextFile(text: "new", file: LocalResource.FromPath("output\\CopyFile_Full.src.txt"));
            system.WriteTextFile(text: "old", file: LocalResource.FromPath("output\\CopyFile_Full.dst.txt"));
            // 上書きでコピー
            system.CopyFile(path: "output\\CopyFile_Full.src.txt", destination: "output\\CopyFile_Full.dst.txt", overwrite: true);
            txt = system.ReadTextFile(file: LocalResource.FromPath("output\\CopyFile_Full.dst.txt"));
            Log(message: txt, level: UiPath.CodedWorkflows.LogLevel.Info);
        }
    }
}
