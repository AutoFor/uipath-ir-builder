using System;
using System.Collections.Generic;
using System.Data;
using System.IO;
using System.Linq;
using UiPath.CodedWorkflows;
using UiPath.Platform.ResourceHandling;

namespace CatalogProbeNet8
{
    // tools/ir/gen-coded.ts で IR（ReadTextFile_Full）から生成。手で直さず IR を直す
    public class ReadTextFile_Full : CodedWorkflow
    {
        [Workflow]
        public void Execute()
        {
            ILocalResource res = default;
            String txt = default;
            res = system.CreateFile(name: "ReadTextFile_Full.txt", path: "output");
            system.WriteTextFile(text: "日本語の中身", file: res, encoding: "utf-8");
            // UTF-8 で読む
            txt = system.ReadTextFile(file: res, encoding: "utf-8");
            Log(message: txt, level: UiPath.CodedWorkflows.LogLevel.Info);
        }
    }
}
