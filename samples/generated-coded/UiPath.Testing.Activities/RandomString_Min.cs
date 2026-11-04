using System;
using System.Collections.Generic;
using System.Data;
using System.IO;
using System.Linq;
using UiPath.CodedWorkflows;
using UiPath.Platform.ResourceHandling;

namespace CatalogProbeNet8
{
    // tools/ir/gen-coded.ts で IR（RandomString_Min）から生成。手で直さず IR を直す
    public class RandomString_Min : CodedWorkflow
    {
        [Workflow]
        public void Execute()
        {
            String s = default;
            // 大文字 8 文字
            s = testing.RandomString(caseValue: UiPath.Testing.Enums.Case.UpperCase, length: 8);
            Log(message: Convert.ToString("length=" + s.Length + " upper=" + (s == s.ToUpper())), level: UiPath.CodedWorkflows.LogLevel.Info);
        }
    }
}
