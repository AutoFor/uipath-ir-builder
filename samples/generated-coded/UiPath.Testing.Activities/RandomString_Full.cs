using System;
using System.Collections.Generic;
using System.Data;
using System.IO;
using System.Linq;
using UiPath.CodedWorkflows;
using UiPath.Platform.ResourceHandling;

namespace CatalogProbeNet8
{
    // tools/ir/gen-coded.ts で IR（RandomString_Full）から生成。手で直さず IR を直す
    public class RandomString_Full : CodedWorkflow
    {
        [Workflow]
        public void Execute()
        {
            String lower = default;
            String mixed = default;
            // 小文字 5 文字
            lower = testing.RandomString(caseValue: UiPath.Testing.Enums.Case.LowerCase, length: 5);
            // 混在 12 文字
            mixed = testing.RandomString(caseValue: UiPath.Testing.Enums.Case.Mixed, length: 12);
            Log(message: Convert.ToString("lower=" + lower.Length + " " + (lower == lower.ToLower())), level: UiPath.CodedWorkflows.LogLevel.Info);
            Log(message: Convert.ToString("mixed=" + mixed.Length), level: UiPath.CodedWorkflows.LogLevel.Info);
        }
    }
}
