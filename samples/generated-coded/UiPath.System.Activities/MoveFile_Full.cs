using System;
using System.Collections.Generic;
using System.Data;
using System.IO;
using System.Linq;
using UiPath.CodedWorkflows;
using UiPath.Platform.ResourceHandling;

namespace CatalogProbeNet8
{
    // tools/ir/gen-coded.ts で IR（MoveFile_Full）から生成。手で直さず IR を直す
    public class MoveFile_Full : CodedWorkflow
    {
        [Workflow]
        public void Execute()
        {
            String txt = default;
            system.WriteTextFile(text: "new", file: LocalResource.FromPath("output\\MoveFile_Full.src.txt"));
            system.WriteTextFile(text: "old", file: LocalResource.FromPath("output\\MoveFile_Full.dst.txt"));
            // 上書きで移動
            System.IO.File.Move("output\\MoveFile_Full.src.txt", "output\\MoveFile_Full.dst.txt", true);
            txt = system.ReadTextFile(file: LocalResource.FromPath("output\\MoveFile_Full.dst.txt"));
            Log(message: txt, level: UiPath.CodedWorkflows.LogLevel.Info);
        }
    }
}
