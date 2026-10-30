using System;
using System.Collections.Generic;
using System.Data;
using System.IO;
using System.Linq;
using UiPath.CodedWorkflows;
using UiPath.Platform.ResourceHandling;

namespace CatalogProbeNet8
{
    // tools/ir/gen-coded.ts で IR（CombineText_Full）から生成。手で直さず IR を直す
    public class CombineText_Full : CodedWorkflow
    {
        [Workflow]
        public void Execute()
        {
            List<String> parts = default;
            String r1 = default;
            String r2 = default;
            String r3 = default;
            parts = new List<string> { "a", "b", "c" };
            // カンマでつなぐ
            r1 = false ? system.CombineText(parts, ",") : system.CombineText(parts, UiPath.Activities.System.Text.SeparatorOptions.Comma);
            // スペースでつなぐ
            r2 = false ? system.CombineText(parts, " ") : system.CombineText(parts, UiPath.Activities.System.Text.SeparatorOptions.Space);
            // 任意の文字でつなぐ
            r3 = true ? system.CombineText(parts, "::") : system.CombineText(parts, UiPath.Activities.System.Text.SeparatorOptions.Custom);
            Log(message: r1, level: UiPath.CodedWorkflows.LogLevel.Info);
            Log(message: r2, level: UiPath.CodedWorkflows.LogLevel.Info);
            Log(message: r3, level: UiPath.CodedWorkflows.LogLevel.Info);
        }
    }
}
