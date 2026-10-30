using System;
using System.Collections.Generic;
using System.Data;
using System.IO;
using System.Linq;
using UiPath.CodedWorkflows;
using UiPath.Platform.ResourceHandling;

namespace CatalogProbeNet8
{
    // tools/ir/gen-coded.ts で IR（AppendLine_Min）から生成。手で直さず IR を直す
    public class AppendLine_Min : CodedWorkflow
    {
        [Workflow]
        public void Execute()
        {
            String txt = default;
            system.WriteTextFile(text: "first", file: LocalResource.FromPath("output\\AppendLine_Min.txt"));
            system.AppendLine(text: "second", file: LocalResource.FromPath("output\\AppendLine_Min.txt"));
            txt = system.ReadTextFile(file: LocalResource.FromPath("output\\AppendLine_Min.txt"));
            Log(message: Convert.ToString(txt.Replace(Environment.NewLine, "|")), level: UiPath.CodedWorkflows.LogLevel.Info);
        }
    }
}
