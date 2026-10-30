using System;
using System.Collections.Generic;
using System.Data;
using System.IO;
using System.Linq;
using UiPath.CodedWorkflows;
using UiPath.Platform.ResourceHandling;

namespace CatalogProbeNet8
{
    // tools/ir/gen-coded.ts で IR（FindAndReplace_Full）から生成。手で直さず IR を直す
    public class FindAndReplace_Full : CodedWorkflow
    {
        [Workflow]
        public void Execute()
        {
            String r1 = default;
            String r2 = default;
            // 大文字小文字を区別しない
            r1 = system.FindAndReplace(valueToFind: "HELLO", source: "Hello hello World", replaceWith: "bye", matchCase: false);
            // 大文字小文字を区別する
            r2 = system.FindAndReplace(valueToFind: "hello", source: "Hello hello World", replaceWith: "bye", matchCase: true);
            Log(message: r1, level: UiPath.CodedWorkflows.LogLevel.Info);
            Log(message: r2, level: UiPath.CodedWorkflows.LogLevel.Info);
        }
    }
}
