using System;
using System.Collections.Generic;
using System.Data;
using System.IO;
using System.Linq;
using UiPath.CodedWorkflows;
using UiPath.Platform.ResourceHandling;

namespace CatalogProbeNet8
{
    // tools/ir/gen-coded.ts で IR（WriteTextFile_Full）から生成。手で直さず IR を直す
    public class WriteTextFile_Full : CodedWorkflow
    {
        [Workflow]
        public void Execute()
        {
            ILocalResource res = default;
            ILocalResource outRes = default;
            String txt = default;
            res = system.CreateFile(name: "WriteTextFile_Full.txt", path: "output");
            // リソースへ書く
            system.WriteTextFile("全部入り", res, "utf-8"); outRes = res;
            txt = system.ReadTextFile(file: outRes, encoding: "utf-8");
            Log(message: txt, level: UiPath.CodedWorkflows.LogLevel.Info);
        }
    }
}
