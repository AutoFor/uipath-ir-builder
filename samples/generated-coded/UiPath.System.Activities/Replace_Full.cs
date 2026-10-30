using System;
using System.Collections.Generic;
using System.Data;
using System.IO;
using System.Linq;
using UiPath.CodedWorkflows;
using UiPath.Platform.ResourceHandling;

namespace CatalogProbeNet8
{
    // tools/ir/gen-coded.ts で IR（Replace_Full）から生成。手で直さず IR を直す
    public class Replace_Full : CodedWorkflow
    {
        [Workflow]
        public void Execute()
        {
            String r = default;
            // 正規表現で置き換える
            r = system.Replace(input: "John@Example", pattern: "(\\w+)@(\\w+)", replacement: "$2 at $1", regexOption: System.Text.RegularExpressions.RegexOptions.IgnoreCase | System.Text.RegularExpressions.RegexOptions.Compiled);
            Log(message: r, level: UiPath.CodedWorkflows.LogLevel.Info);
        }
    }
}
