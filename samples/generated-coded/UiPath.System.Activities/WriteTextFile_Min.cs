using System;
using System.Collections.Generic;
using System.Data;
using System.IO;
using System.Linq;
using UiPath.CodedWorkflows;
using UiPath.Platform.ResourceHandling;

namespace CatalogProbeNet8
{
    // tools/ir/gen-coded.ts で IR（WriteTextFile_Min）から生成。手で直さず IR を直す
    public class WriteTextFile_Min : CodedWorkflow
    {
        [Workflow]
        public void Execute()
        {
            String txt = default;
            system.WriteTextFile(text: "written", file: LocalResource.FromPath("output\\WriteTextFile_Min.txt"));
            txt = system.ReadTextFile(file: LocalResource.FromPath("output\\WriteTextFile_Min.txt"));
            Log(message: txt, level: UiPath.CodedWorkflows.LogLevel.Info);
        }
    }
}
