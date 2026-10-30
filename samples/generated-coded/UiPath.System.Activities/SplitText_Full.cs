using System;
using System.Collections.Generic;
using System.Data;
using System.IO;
using System.Linq;
using UiPath.CodedWorkflows;
using UiPath.Platform.ResourceHandling;

namespace CatalogProbeNet8
{
    // tools/ir/gen-coded.ts で IR（SplitText_Full）から生成。手で直さず IR を直す
    public class SplitText_Full : CodedWorkflow
    {
        [Workflow]
        public void Execute()
        {
            IEnumerable<String> p1 = default;
            IEnumerable<String> p2 = default;
            IEnumerable<String> p3 = default;
            // スペースで分ける
            p1 = false ? system.SplitText("x y z", " ") : system.SplitText("x y z", UiPath.Activities.System.Text.SeparatorOptions.Space);
            // セミコロンで分ける
            p2 = false ? system.SplitText("1;2;3", ";") : system.SplitText("1;2;3", UiPath.Activities.System.Text.SeparatorOptions.SemiColon);
            // 任意の文字で分ける
            p3 = true ? system.SplitText("p--q--r", "--") : system.SplitText("p--q--r", UiPath.Activities.System.Text.SeparatorOptions.Custom);
            Log(message: Convert.ToString(string.Join("|", p1)), level: UiPath.CodedWorkflows.LogLevel.Info);
            Log(message: Convert.ToString(string.Join("|", p2)), level: UiPath.CodedWorkflows.LogLevel.Info);
            Log(message: Convert.ToString(string.Join("|", p3)), level: UiPath.CodedWorkflows.LogLevel.Info);
        }
    }
}
